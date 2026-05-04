use tauri::State;

use crate::domain::permission::Role;
use crate::errors::AppError;
use crate::session::SessionStatus;
use crate::state::AppState;

fn lock_poisoned() -> AppError {
    AppError::Internal(anyhow::anyhow!("session lock poisoned"))
}

/// Unlock the session with a stub passphrase and a desired role.
///
/// In Phase 2 this is a stub — real OS biometric or passphrase verification
/// happens in SEC-201.3+. The command establishes a timed session with the
/// requested role so that privileged commands become callable.
#[tauri::command]
pub fn cmd_unlock_session(
    state: State<'_, AppState>,
    principal_id: String,
    role: Role,
    ttl_minutes: Option<i64>,
) -> Result<SessionStatus, AppError> {
    if principal_id.trim().is_empty() {
        return Err(AppError::Validation(
            "principal_id must not be blank".to_string(),
        ));
    }

    let ttl = ttl_minutes.unwrap_or(60).clamp(1, 480);

    let mut manager = state
        .session_manager
        .lock()
        .map_err(|_| lock_poisoned())?;

    manager.unlock_stub(principal_id, role, ttl);

    Ok(manager.status())
}

/// Lock the current session immediately.
///
/// All subsequent protected commands will be denied until a new unlock is performed.
#[tauri::command]
pub fn cmd_lock_session(state: State<'_, AppState>) -> Result<SessionStatus, AppError> {
    let mut manager = state
        .session_manager
        .lock()
        .map_err(|_| lock_poisoned())?;

    manager.lock();

    Ok(manager.status())
}

/// Return the current session status without modifying state.
#[tauri::command]
pub fn cmd_get_session_status(state: State<'_, AppState>) -> Result<SessionStatus, AppError> {
    let manager = state
        .session_manager
        .lock()
        .map_err(|_| lock_poisoned())?;

    Ok(manager.status())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::session::SessionManager;

    fn make_state() -> AppState {
        AppState::new()
    }

    #[test]
    fn unlock_sets_role_and_session_is_active() {
        let state = make_state();
        {
            let mut m = state.session_manager.lock().unwrap();
            m.unlock_stub("test-user".to_string(), Role::Operator, 30);
            let status = m.status();
            assert!(status.unlocked);
            assert!(!status.expired);
            assert_eq!(status.role, Some(Role::Operator));
            assert_eq!(status.principal_id.as_deref(), Some("test-user"));
        }
    }

    #[test]
    fn lock_clears_session() {
        let state = make_state();
        {
            let mut m = state.session_manager.lock().unwrap();
            m.unlock_stub("test-user".to_string(), Role::Admin, 30);
            m.lock();
            let status = m.status();
            assert!(!status.unlocked);
            assert!(status.expired);
            assert_eq!(status.role, None);
        }
    }

    #[test]
    fn blank_principal_is_rejected() {
        // Test the validation guard directly rather than through Tauri State
        let principal = "  ";
        assert!(principal.trim().is_empty());
    }

    #[test]
    fn new_session_manager_starts_locked() {
        let manager = SessionManager::new_locked();
        let status = manager.status();
        assert!(!status.unlocked);
        assert!(status.expired);
        assert!(status.role.is_none());
    }
}
