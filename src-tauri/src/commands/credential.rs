use tauri::State;
use uuid::Uuid;

use crate::commands::audit::append_user_audit;
use crate::commands::authz::require_permission;
use crate::domain::audit::AuditAction;
use crate::domain::credential::{IntegrationCredential, Provider};
use crate::domain::permission::Permission;
use crate::errors::AppError;
use crate::state::AppState;
use crate::validation::validate_base_url;

// ──────────────────────────────────────────────────────────────────────────────
// Helper — emit an audit log entry from a command
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// Tauri commands
// ──────────────────────────────────────────────────────────────────────────────

/// Add a new integration credential.
///
/// # Security
/// `secret` is received over the local Tauri IPC channel (not network).
/// It is passed directly to the OS keychain and never stored in memory longer
/// than the duration of this call.  It is never returned, logged, or serialized.
#[tauri::command]
pub fn cmd_add_credential(
    state: State<'_, AppState>,
    provider: Provider,
    label: String,
    secret: String,
    base_url: Option<String>,
) -> Result<IntegrationCredential, AppError> {
    require_permission(&state, Permission::AddCredential, "add_credential")?;

    let normalized_base_url = match base_url {
        Some(url) => Some(validate_base_url(&url)?.normalised),
        None => None,
    };

    let cred = state
        .credential_store
        .add(provider, label, secret.as_str(), normalized_base_url)?;

    append_user_audit(
        &state,
        AuditAction::CredentialAdded,
        Some(format!("provider={}, id={}", cred.provider.display_name(), cred.id)),
    )?;

    Ok(cred)
}

/// Delete a credential by id.
#[tauri::command]
pub fn cmd_delete_credential(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    require_permission(&state, Permission::DeleteCredential, "delete_credential")?;

    let uuid = Uuid::parse_str(&id)
        .map_err(|_| AppError::Validation(format!("invalid credential id: {id}")))?;

    // Capture metadata for audit before deletion
    let label = state
        .credential_store
        .get(uuid)
        .map(|c| c.label.clone())
        .unwrap_or_else(|| id.clone());

    state.credential_store.delete(uuid)?;

    append_user_audit(
        &state,
        AuditAction::CredentialDeleted,
        Some(format!("id={uuid}, label={label}")),
    )?;

    Ok(())
}

/// Check whether the OS keychain entry for a credential is still accessible.
/// Returns `true` if healthy, `false` if the entry is missing or corrupted.
/// Never returns the secret value.
#[tauri::command]
pub fn cmd_check_credential_health(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, AppError> {
    require_permission(
        &state,
        Permission::CheckCredentialHealth,
        "check_credential_health",
    )?;

    let uuid = Uuid::parse_str(&id)
        .map_err(|_| AppError::Validation(format!("invalid credential id: {id}")))?;

    let healthy = state.credential_store.health_check(uuid)?;

    append_user_audit(
        &state,
        AuditAction::CredentialHealthChecked,
        Some(format!("id={uuid}, healthy={healthy}")),
    )?;

    Ok(healthy)
}

/// List all credential metadata records.
/// Secrets are never included in the returned data.
#[tauri::command]
pub fn cmd_list_credentials(
    state: State<'_, AppState>,
) -> Result<Vec<IntegrationCredential>, AppError> {
    require_permission(&state, Permission::ViewCredentialList, "list_credentials")?;
    Ok(state.credential_store.list())
}
