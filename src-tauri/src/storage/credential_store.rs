use std::collections::HashMap;
use std::sync::Mutex;

use uuid::Uuid;

use crate::domain::credential::{IntegrationCredential, Provider};
use crate::errors::AppError;
use crate::sync_utils::lock_or_internal;

const SERVICE: &str = "com.productoverlord.app";

// ──────────────────────────────────────────────────────────────────────────────
// Secret-storage backend abstraction
// ──────────────────────────────────────────────────────────────────────────────

/// Backend abstraction for OS secret storage.
/// The production impl delegates to the OS keychain via `keyring`.
/// Tests inject `MockBackend` so no real keychain access is needed in CI.
pub(crate) trait SecretBackend: Send + Sync {
    fn store(&self, account: &str, secret: &str) -> Result<(), AppError>;
    fn retrieve(&self, account: &str) -> Result<String, AppError>;
    fn delete(&self, account: &str) -> Result<(), AppError>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Production: OS keychain via `keyring` crate
// ──────────────────────────────────────────────────────────────────────────────

pub(crate) struct KeyringBackend {
    service: String,
}

impl KeyringBackend {
    pub fn new(service: impl Into<String>) -> Self {
        Self { service: service.into() }
    }
}

impl SecretBackend for KeyringBackend {
    fn store(&self, account: &str, secret: &str) -> Result<(), AppError> {
        keyring::Entry::new(&self.service, account)
            .and_then(|e| e.set_password(secret))
            .map_err(|e| AppError::Credential(e.to_string()))
    }

    fn retrieve(&self, account: &str) -> Result<String, AppError> {
        keyring::Entry::new(&self.service, account)
            .and_then(|e| e.get_password())
            .map_err(|e| AppError::Credential(e.to_string()))
    }

    fn delete(&self, account: &str) -> Result<(), AppError> {
        keyring::Entry::new(&self.service, account)
            .and_then(|e| e.delete_credential())
            .map_err(|e| AppError::Credential(e.to_string()))
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// CredentialStore — metadata + secret lifecycle
// ──────────────────────────────────────────────────────────────────────────────

/// Manages credential metadata (in-memory, Phase 1C) and secrets (OS keychain).
///
/// # Security contract
/// - Secrets are stored exclusively in the OS keychain via `SecretBackend`.
/// - No secret value is ever held in a struct field, returned to callers,
///   or sent across the Tauri IPC boundary.
/// - Metadata records (`IntegrationCredential`) contain only non-sensitive fields.
/// - Phase 1E will migrate the metadata map to LanceDB.
pub struct CredentialStore {
    /// Non-secret metadata, keyed by credential id.
    credentials: Mutex<HashMap<Uuid, IntegrationCredential>>,
    backend: Box<dyn SecretBackend>,
}

impl CredentialStore {
    /// Production constructor — uses the OS keychain.
    pub fn new() -> Self {
        Self {
            credentials: Mutex::new(HashMap::new()),
            backend: Box::new(KeyringBackend::new(SERVICE)),
        }
    }

    /// Test constructor — inject any backend (e.g. MockBackend).
    #[cfg(test)]
    pub(crate) fn with_backend(backend: impl SecretBackend + 'static) -> Self {
        Self {
            credentials: Mutex::new(HashMap::new()),
            backend: Box::new(backend),
        }
    }

    /// Add a new credential. Stores the secret in the keychain and returns
    /// the metadata record. The secret is never returned or logged.
    pub fn add(
        &self,
        provider: Provider,
        label: String,
        secret: &str,
        base_url: Option<String>,
    ) -> Result<IntegrationCredential, AppError> {
        if secret.is_empty() {
            return Err(AppError::Validation("secret must not be empty".to_string()));
        }
        if label.trim().is_empty() {
            return Err(AppError::Validation("label must not be empty".to_string()));
        }

        let cred = IntegrationCredential::new(provider, label, base_url);

        // Persist to keychain BEFORE adding to the in-memory map.
        // If keychain write fails, no metadata is registered.
        self.backend.store(&cred.id.to_string(), secret)?;

        let mut map = lock_or_internal(&self.credentials, "credential_store")?;
        map.insert(cred.id, cred.clone());
        Ok(cred)
    }

    /// Delete a credential — removes both the keychain entry and metadata.
    /// Returns an error if the id is not found.
    pub fn delete(&self, id: Uuid) -> Result<(), AppError> {
        {
            let map = lock_or_internal(&self.credentials, "credential_store")?;
            if !map.contains_key(&id) {
                return Err(AppError::Credential(format!("credential {id} not found")));
            }
        }

        // Remove from keychain first. If this fails we keep metadata intact
        // so the operator can retry rather than ending up with an orphaned keychain entry.
        self.backend.delete(&id.to_string())?;

        let mut map = lock_or_internal(&self.credentials, "credential_store")?;
        map.remove(&id);
        Ok(())
    }

    /// Check whether the keychain entry is still accessible.
    /// Returns `true` if the secret can be retrieved, `false` if the entry is
    /// absent or corrupted.  The secret value is discarded immediately.
    ///
    /// # Security
    /// This method never surfaces the secret — it only confirms reachability.
    pub fn health_check(&self, id: Uuid) -> Result<bool, AppError> {
        {
            let map = lock_or_internal(&self.credentials, "credential_store")?;
            if !map.contains_key(&id) {
                return Err(AppError::Credential(format!("credential {id} not found")));
            }
        }

        match self.backend.retrieve(&id.to_string()) {
            Ok(_secret) => {
                // Secret retrieved and immediately dropped — never returned.
                Ok(true)
            }
            Err(AppError::Credential(_)) => Ok(false),
            Err(e) => Err(e),
        }
    }

    /// Return all credential metadata records. Secrets are never included.
    pub fn list(&self) -> Result<Vec<IntegrationCredential>, AppError> {
        let map = lock_or_internal(&self.credentials, "credential_store")?;
        let mut items: Vec<_> = map.values().cloned().collect();
        // Stable order: newest first
        items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        Ok(items)
    }

    /// Retrieve a single credential metadata record by id.
    pub fn get(&self, id: Uuid) -> Result<Option<IntegrationCredential>, AppError> {
        let map = lock_or_internal(&self.credentials, "credential_store")?;
        Ok(map.get(&id).cloned())
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests — use MockBackend; no OS keychain access required
// ──────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// In-memory mock that stands in for the OS keychain in tests.
    struct MockBackend {
        secrets: Mutex<HashMap<String, String>>,
    }

    impl MockBackend {
        fn new() -> Self {
            Self { secrets: Mutex::new(HashMap::new()) }
        }
    }

    impl SecretBackend for MockBackend {
        fn store(&self, account: &str, secret: &str) -> Result<(), AppError> {
            self.secrets.lock().unwrap().insert(account.to_string(), secret.to_string());
            Ok(())
        }

        fn retrieve(&self, account: &str) -> Result<String, AppError> {
            self.secrets
                .lock()
                .unwrap()
                .get(account)
                .cloned()
                .ok_or_else(|| AppError::Credential(format!("not found: {account}")))
        }

        fn delete(&self, account: &str) -> Result<(), AppError> {
            self.secrets.lock().unwrap().remove(account);
            Ok(())
        }
    }

    fn make_store() -> CredentialStore {
        CredentialStore::with_backend(MockBackend::new())
    }

    // ── add ──────────────────────────────────────────────────────────────────

    #[test]
    fn add_returns_metadata_without_secret() {
        let store = make_store();
        let cred = store
            .add(Provider::Jira, "my-jira".to_string(), "s3cr3t", None)
            .unwrap();
        assert_eq!(cred.label, "my-jira");
        assert_eq!(cred.provider, Provider::Jira);
        // No secret field in IntegrationCredential
    }

    #[test]
    fn add_empty_secret_is_rejected() {
        let store = make_store();
        let err = store.add(Provider::GitHub, "label".to_string(), "", None).unwrap_err();
        assert!(err.to_string().contains("secret must not be empty"));
    }

    #[test]
    fn add_blank_label_is_rejected() {
        let store = make_store();
        let err = store.add(Provider::GitHub, "   ".to_string(), "tok", None).unwrap_err();
        assert!(err.to_string().contains("label must not be empty"));
    }

    #[test]
    fn add_stores_secret_in_backend() {
        let backend = MockBackend::new();
        // Peek into backend after add to confirm secret was written
        let store = CredentialStore::with_backend(MockBackend::new());
        let _ = store.add(Provider::Jira, "j".to_string(), "mytoken", None).unwrap();
        // health_check confirms the backend has it
        let id = store.list().unwrap()[0].id;
        assert!(store.health_check(id).unwrap());
        let _ = backend; // suppress unused warning
    }

    // ── list ─────────────────────────────────────────────────────────────────

    #[test]
    fn list_returns_all_metadata() {
        let store = make_store();
        store.add(Provider::Jira, "a".to_string(), "s1", None).unwrap();
        store.add(Provider::GitHub, "b".to_string(), "s2", None).unwrap();
        assert_eq!(store.list().unwrap().len(), 2);
    }

    #[test]
    fn list_is_empty_initially() {
        let store = make_store();
        assert!(store.list().unwrap().is_empty());
    }

    // ── delete ───────────────────────────────────────────────────────────────

    #[test]
    fn delete_removes_credential() {
        let store = make_store();
        let cred = store.add(Provider::Jira, "j".to_string(), "tok", None).unwrap();
        store.delete(cred.id).unwrap();
        assert!(store.get(cred.id).unwrap().is_none());
        assert!(store.list().unwrap().is_empty());
    }

    #[test]
    fn delete_unknown_id_returns_error() {
        let store = make_store();
        let err = store.delete(Uuid::new_v4()).unwrap_err();
        assert!(err.to_string().contains("credential error"));
    }

    #[test]
    fn delete_after_delete_returns_error() {
        let store = make_store();
        let cred = store.add(Provider::Jira, "j".to_string(), "tok", None).unwrap();
        store.delete(cred.id).unwrap();
        let err = store.delete(cred.id).unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    // ── health_check ─────────────────────────────────────────────────────────

    #[test]
    fn health_check_returns_true_for_healthy_credential() {
        let store = make_store();
        let cred = store.add(Provider::Jira, "j".to_string(), "tok", None).unwrap();
        assert!(store.health_check(cred.id).unwrap());
    }

    #[test]
    fn health_check_returns_false_after_keychain_entry_removed() {
        // Simulate a keychain entry going missing while metadata remains:
        // we test this by constructing a backend that returns not-found after delete.
        struct FailingBackend;
        impl SecretBackend for FailingBackend {
            fn store(&self, _: &str, _: &str) -> Result<(), AppError> { Ok(()) }
            fn retrieve(&self, a: &str) -> Result<String, AppError> {
                Err(AppError::Credential(format!("not in keychain: {a}")))
            }
            fn delete(&self, _: &str) -> Result<(), AppError> { Ok(()) }
        }
        let store = CredentialStore::with_backend(FailingBackend);
        // Manually insert metadata to simulate an orphaned record
        {
            let fake = IntegrationCredential::new(Provider::Jira, "orphan", None);
            let mut map = store.credentials.lock().unwrap();
            map.insert(fake.id, fake.clone());
            // Health-check via the id we just inserted
            drop(map);
            let id = store.list().unwrap()[0].id;
            assert!(!store.health_check(id).unwrap());
        }
    }

    #[test]
    fn health_check_unknown_id_returns_error() {
        let store = make_store();
        let err = store.health_check(Uuid::new_v4()).unwrap_err();
        assert!(err.to_string().contains("credential error"));
    }
}
