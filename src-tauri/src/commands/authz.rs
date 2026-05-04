use crate::domain::audit::{AuditAction, AuditActor, AuditLogEntry};
use crate::domain::permission::{
    minimum_role_for_permission, role_has_permission, Permission, Role,
};
use crate::errors::AppError;
use crate::state::AppState;

pub fn current_role(state: &AppState) -> Role {
    state.current_role.lock().unwrap().clone()
}

pub fn require_permission(
    state: &AppState,
    permission: Permission,
    action: &str,
) -> Result<(), AppError> {
    let role = current_role(state);

    if role_has_permission(&role, &permission) {
        return Ok(());
    }

    let required_role = minimum_role_for_permission(&permission);

    let details = format!(
        "action={action}, permission={permission:?}, role={}, required_role={}",
        role.display_name(),
        required_role.display_name()
    );

    let entry = AuditLogEntry::new(
        AuditAction::PermissionDenied,
        AuditActor::User {
            name: "desktop".to_string(),
        },
        Some(details),
    );
    let _ = state.audit_store.append(&entry);

    Err(AppError::PermissionDenied {
        action: action.to_string(),
        required_role,
    })
}
