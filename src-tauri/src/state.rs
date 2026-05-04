use std::sync::Mutex;

use crate::llm::LlmGateway;
use crate::session::SessionManager;
use crate::storage::audit_store::AuditStore;
use crate::storage::credential_store::CredentialStore;
use crate::storage::index_store::IndexStore;
use crate::storage::scaffold_store::ScaffoldStore;

/// Shared application state managed by Tauri.
///
/// All fields must be `Send + Sync` since Tauri commands run on multiple threads.
///
/// # Persistence note
/// - `credential_store` metadata is in-memory for Phase 1C.  Phase 1E migrates
///   it to LanceDB.
/// - `audit_store` is append-only on disk as of Phase 1G.
pub struct AppState {
    pub session_manager: Mutex<SessionManager>,
    pub credential_store: CredentialStore,
    pub index_store: IndexStore,
    pub llm_gateway: LlmGateway,
    pub scaffold_store: ScaffoldStore,
    pub audit_store: AuditStore,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            session_manager: Mutex::new(SessionManager::new_locked()),
            credential_store: CredentialStore::new(),
            index_store: IndexStore::new(),
            llm_gateway: LlmGateway::new(),
            scaffold_store: ScaffoldStore::new(),
            audit_store: AuditStore::new(),
        }
    }
}
