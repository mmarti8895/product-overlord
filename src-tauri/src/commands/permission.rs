use tauri::State;

use crate::commands::audit::append_user_audit;
use crate::commands::authz::{effective_role, require_permission};
use crate::domain::audit::AuditAction;
use crate::domain::permission::{Permission, Role};
use crate::errors::AppError;
use crate::state::AppState;

/// Return the effective role derived from the current session.
///
/// Returns `ReadOnly` (the minimum role) when the session is locked or expired
/// so that callers can always display a meaningful state.
#[tauri::command]
pub fn cmd_get_current_role(state: State<'_, AppState>) -> Result<Role, AppError> {
    Ok(effective_role(&state)?.unwrap_or(Role::ReadOnly))
}

/// Change the role on the current active session.
///
/// Requires `AssignRoles` permission (Admin only). The session must already be
/// unlocked — a locked session cannot elevate itself.
#[tauri::command]
pub fn cmd_set_current_role(
    state: State<'_, AppState>,
    new_role: Role,
) -> Result<Role, AppError> {
    require_permission(&state, Permission::AssignRoles, "set_current_role")?;

    let previous = effective_role(&state)?.unwrap_or(Role::ReadOnly);

    {
        let mut manager = state
            .session_manager
            .lock()
            .map_err(|_| AppError::Internal(anyhow::anyhow!("session lock poisoned")))?;
        manager.set_role(new_role.clone());
    }

    append_user_audit(
        &state,
        AuditAction::RoleAssigned,
        Some(format!(
            "role changed from {} to {}",
            previous.display_name(),
            new_role.display_name()
        )),
    )?;

    Ok(new_role)
}
