use tauri::State;

use crate::commands::audit::append_user_audit;
use crate::commands::authz::require_permission;
use crate::domain::audit::AuditAction;
use crate::domain::permission::Permission;
use crate::errors::AppError;
use crate::state::AppState;
use crate::storage::index_store::IndexStoreHealth;

/// Initialize the local LanceDB storage directory and validate connectivity.
#[tauri::command]
pub fn cmd_initialize_index_store(
    state: State<'_, AppState>,
    db_uri: Option<String>,
) -> Result<IndexStoreHealth, AppError> {
    require_permission(
        &state,
        Permission::TriggerRepositoryIndex,
        "initialize_index_store",
    )?;

    match state.index_store.initialize(db_uri.clone()) {
        Ok(health) => {
            append_user_audit(
                &state,
                AuditAction::RepositoryIndexCompleted,
                Some(format!("lancedb initialized at {}", health.db_uri)),
            )?;
            Ok(health)
        }
        Err(err) => {
            append_user_audit(
                &state,
                AuditAction::RepositoryIndexFailed,
                Some(format!("lancedb init failed ({})", err.frontend_message())),
            )?;
            Err(err)
        }
    }
}

/// Return the latest in-memory snapshot for index store health without probing.
#[tauri::command]
pub fn cmd_get_index_store_health(
    state: State<'_, AppState>,
) -> Result<IndexStoreHealth, AppError> {
    require_permission(
        &state,
        Permission::ViewRepositoryIndex,
        "get_index_store_health",
    )?;

    Ok(state.index_store.current_health())
}

/// Probe LanceDB connectivity and return a fresh health snapshot.
#[tauri::command]
pub fn cmd_check_index_store_health(
    state: State<'_, AppState>,
) -> Result<IndexStoreHealth, AppError> {
    require_permission(
        &state,
        Permission::ViewRepositoryIndex,
        "check_index_store_health",
    )?;

    Ok(state.index_store.health_check())
}
