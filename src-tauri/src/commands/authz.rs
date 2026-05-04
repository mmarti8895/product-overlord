use crate::commands::audit::append_user_audit;
use crate::domain::audit::AuditAction;
use crate::domain::permission::{
    minimum_role_for_permission, role_has_permission, Permission, Role,
};
use crate::errors::AppError;
use crate::state::AppState;
use crate::sync_utils::lock_or_internal;

/// Resolve the effective role from the active session.
///
/// Returns `Ok(None)` when the session is locked or expired.
/// Returns `Err(AppError::Internal)` when the session mutex is poisoned.
///
/// # SEC-206.2 — Poisoned-lock resilience
/// Uses `lock_or_internal` instead of `.unwrap()` so lock poisoning surfaces
/// as a controlled `AppError` rather than a panic.
pub fn effective_role(state: &AppState) -> Result<Option<Role>, AppError> {
    let manager = lock_or_internal(&state.session_manager, "session_manager")?;
    let status = manager.status();
    if status.unlocked && !status.expired {
        Ok(status.role)
    } else {
        Ok(None)
    }
}

pub fn require_permission(
    state: &AppState,
    permission: Permission,
    action: &str,
) -> Result<(), AppError> {
    let role = match effective_role(state)? {
        Some(r) => r,
        None => {
            let details = format!(
                "action={action}, permission={permission:?}, reason=session_locked_or_expired"
            );
            append_user_audit(state, AuditAction::PermissionDenied, Some(details))?;
            return Err(AppError::PermissionDenied {
                action: action.to_string(),
                required_role: minimum_role_for_permission(&permission),
            });
        }
    };

    if role_has_permission(&role, &permission) {
        return Ok(());
    }

    let required_role = minimum_role_for_permission(&permission);

    let details = format!(
        "action={action}, permission={permission:?}, role={}, required_role={}",
        role.display_name(),
        required_role.display_name()
    );

    append_user_audit(state, AuditAction::PermissionDenied, Some(details))?;

    Err(AppError::PermissionDenied {
        action: action.to_string(),
        required_role,
    })
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, Utc};

    use super::*;
    use crate::domain::permission::Permission;
    use crate::session::{SessionManager, SessionState};

    fn locked_state() -> AppState {
        AppState::new() // starts locked by default
    }

    fn state_with_role(role: Role) -> AppState {
        let state = AppState::new();
        {
            let mut m = state.session_manager.lock().unwrap();
            m.unlock_stub("test".to_string(), role, 60);
        }
        state
    }

    fn state_with_expired_session(role: Role) -> AppState {
        let state = AppState::new();
        {
            let mut m = state.session_manager.lock().unwrap();
            let expired = SessionState {
                principal_id: Some("test".to_string()),
                role: Some(role),
                issued_at: Some(Utc::now() - Duration::minutes(120)),
                expires_at: Some(Utc::now() - Duration::minutes(1)),
                unlocked: true,
            };
            *m = SessionManager::from_state(expired);
        }
        state
    }

    // ── locked session ────────────────────────────────────────────────────────

    #[test]
    fn locked_session_denies_add_credential() {
        let state = locked_state();
        let err = require_permission(&state, Permission::AddCredential, "test").unwrap_err();
        assert!(matches!(err, AppError::PermissionDenied { .. }));
    }

    #[test]
    fn locked_session_denies_assign_roles() {
        let state = locked_state();
        let err = require_permission(&state, Permission::AssignRoles, "test").unwrap_err();
        assert!(matches!(err, AppError::PermissionDenied { .. }));
    }

    #[test]
    fn locked_session_denies_invoke_llm() {
        let state = locked_state();
        let err = require_permission(&state, Permission::InvokeLlm, "test").unwrap_err();
        assert!(matches!(err, AppError::PermissionDenied { .. }));
    }

    #[test]
    fn locked_session_denies_trigger_index() {
        let state = locked_state();
        let err =
            require_permission(&state, Permission::TriggerRepositoryIndex, "test").unwrap_err();
        assert!(matches!(err, AppError::PermissionDenied { .. }));
    }

    // ── role too low ──────────────────────────────────────────────────────────

    #[test]
    fn operator_can_add_credential() {
        let state = state_with_role(Role::Operator);
        assert!(require_permission(&state, Permission::AddCredential, "test").is_ok());
    }

    #[test]
    fn operator_cannot_assign_roles() {
        let state = state_with_role(Role::Operator);
        let err = require_permission(&state, Permission::AssignRoles, "test").unwrap_err();
        assert!(matches!(
            err,
            AppError::PermissionDenied {
                required_role: Role::Admin,
                ..
            }
        ));
    }

    #[test]
    fn readonly_cannot_add_credential() {
        let state = state_with_role(Role::ReadOnly);
        let err = require_permission(&state, Permission::AddCredential, "test").unwrap_err();
        assert!(matches!(err, AppError::PermissionDenied { .. }));
    }

    #[test]
    fn admin_can_assign_roles() {
        let state = state_with_role(Role::Admin);
        assert!(require_permission(&state, Permission::AssignRoles, "test").is_ok());
    }

    // ── expired session ───────────────────────────────────────────────────────

    #[test]
    fn expired_session_denies_add_credential() {
        let state = state_with_expired_session(Role::Admin);
        let err = require_permission(&state, Permission::AddCredential, "test").unwrap_err();
        assert!(matches!(err, AppError::PermissionDenied { .. }));
    }

    #[test]
    fn expired_session_denies_even_when_role_would_permit() {
        // Even an Admin-role session is denied if the TTL has elapsed.
        let state = state_with_expired_session(Role::Admin);
        let err = require_permission(&state, Permission::AssignRoles, "test").unwrap_err();
        assert!(matches!(err, AppError::PermissionDenied { .. }));
    }

    // ── SEC-206.4: poisoned lock tests ────────────────────────────────────────

    #[test]
    fn poisoned_session_manager_returns_internal_error_not_panic() {
        // We can't safely poison the mutex inside AppState from the outside, but
        // we can construct an equivalent scenario using a standalone Mutex and
        // verify the lock_or_internal helper converts poison into AppError::Internal.
        let mutex = std::sync::Mutex::new(42u32);
        let _ = std::panic::catch_unwind(|| {
            let _guard = mutex.lock().unwrap();
            panic!("simulated panic inside critical section");
        });

        // Mutex is now poisoned.
        assert!(mutex.is_poisoned());

        let result = crate::sync_utils::lock_or_internal(&mutex, "test_component");
        assert!(
            result.is_err(),
            "expected Err from poisoned lock, got Ok"
        );
        let err = result.unwrap_err();
        assert!(
            matches!(err, AppError::Internal(_)),
            "expected AppError::Internal, got: {err:?}"
        );
    }

    #[test]
    fn lock_or_internal_succeeds_on_healthy_mutex() {
        let mutex = std::sync::Mutex::new(99u32);
        let result = crate::sync_utils::lock_or_internal(&mutex, "healthy");
        assert!(result.is_ok());
        assert_eq!(*result.unwrap(), 99);
    }
}
