use tauri::State;
use uuid::Uuid;

use crate::domain::audit::{AuditAction, AuditActor, AuditLogEntry};
use crate::domain::credential::{IntegrationCredential, Provider};
use crate::errors::AppError;
use crate::state::AppState;

// ──────────────────────────────────────────────────────────────────────────────
// Helper — emit an audit log entry from a command
// ──────────────────────────────────────────────────────────────────────────────

fn audit(state: &AppState, action: AuditAction, details: Option<String>) {
    let entry = AuditLogEntry::new(action, AuditActor::User { name: "desktop".to_string() }, details);
    state.audit_log.lock().unwrap().push(entry);
}

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
    let cred = state.credential_store.add(provider, label, secret.as_str(), base_url)?;

    audit(
        &state,
        AuditAction::CredentialAdded,
        Some(format!("provider={}, id={}", cred.provider.display_name(), cred.id)),
    );

    Ok(cred)
}

/// Delete a credential by id.
#[tauri::command]
pub fn cmd_delete_credential(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    let uuid = Uuid::parse_str(&id)
        .map_err(|_| AppError::Validation(format!("invalid credential id: {id}")))?;

    // Capture metadata for audit before deletion
    let label = state
        .credential_store
        .get(uuid)
        .map(|c| c.label.clone())
        .unwrap_or_else(|| id.clone());

    state.credential_store.delete(uuid)?;

    audit(
        &state,
        AuditAction::CredentialDeleted,
        Some(format!("id={uuid}, label={label}")),
    );

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
    let uuid = Uuid::parse_str(&id)
        .map_err(|_| AppError::Validation(format!("invalid credential id: {id}")))?;

    let healthy = state.credential_store.health_check(uuid)?;

    audit(
        &state,
        AuditAction::CredentialHealthChecked,
        Some(format!("id={uuid}, healthy={healthy}")),
    );

    Ok(healthy)
}

/// List all credential metadata records.
/// Secrets are never included in the returned data.
#[tauri::command]
pub fn cmd_list_credentials(
    state: State<'_, AppState>,
) -> Vec<IntegrationCredential> {
    state.credential_store.list()
}
