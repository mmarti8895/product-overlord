use std::sync::Mutex;

use crate::domain::audit::AuditLogEntry;
use crate::storage::credential_store::CredentialStore;

/// Shared application state managed by Tauri.
///
/// All fields must be `Send + Sync` since Tauri commands run on multiple threads.
///
/// # Persistence note
/// - `credential_store` metadata is in-memory for Phase 1C.  Phase 1E migrates
///   it to LanceDB.
/// - `audit_log` is in-memory for Phase 1C.  Phase 1G replaces it with an
///   append-only on-disk store.
pub struct AppState {
    pub credential_store: CredentialStore,
    pub audit_log: Mutex<Vec<AuditLogEntry>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            credential_store: CredentialStore::new(),
            audit_log: Mutex::new(Vec::new()),
        }
    }
}
