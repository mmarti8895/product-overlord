use tauri::State;

use crate::commands::authz::require_permission;
use crate::domain::audit::{AuditAction, AuditActor, AuditLogEntry};
use crate::domain::permission::{Permission, Role};
use crate::errors::AppError;
use crate::state::AppState;

fn audit(state: &AppState, action: AuditAction, details: Option<String>) {
    let entry = AuditLogEntry::new(
        action,
        AuditActor::User {
            name: "desktop".to_string(),
        },
        details,
    );
    let _ = state.audit_store.append(&entry);
}

/// Return the current in-memory role used for server-side authorization checks.
#[tauri::command]
pub fn cmd_get_current_role(state: State<'_, AppState>) -> Role {
    state.current_role.lock().unwrap().clone()
}

/// Set the current in-memory role for server-side authorization checks.
/// Only callers with `assign_roles` permission can change roles.
#[tauri::command]
pub fn cmd_set_current_role(
    state: State<'_, AppState>,
    new_role: Role,
) -> Result<Role, AppError> {
    require_permission(&state, Permission::AssignRoles, "set_current_role")?;

    let previous = state.current_role.lock().unwrap().clone();
    *state.current_role.lock().unwrap() = new_role.clone();

    audit(
        &state,
        AuditAction::RoleAssigned,
        Some(format!(
            "role changed from {} to {}",
            previous.display_name(),
            new_role.display_name()
        )),
    );

    Ok(new_role)
}
