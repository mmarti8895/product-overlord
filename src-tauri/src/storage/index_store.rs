use std::fs;
use std::path::Path;
use std::sync::Mutex;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::errors::AppError;
use crate::storage::path_policy::{app_storage_root, enforce_storage_root};

const INDEX_URI_MAX_LEN: usize = 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStoreHealth {
    pub db_uri: String,
    pub initialized: bool,
    pub reachable: bool,
    pub last_checked_at: DateTime<Utc>,
    pub last_error: Option<String>,
}

#[derive(Debug)]
struct IndexStoreState {
    db_uri: String,
    initialized: bool,
    last_checked_at: Option<DateTime<Utc>>,
    last_error: Option<String>,
}

/// LanceDB bootstrap state for local repository indexing.
///
/// Phase 1E scope is intentionally narrow:
/// - initialize a local LanceDB backing store
/// - provide basic health checks to the frontend
///
/// Table/schema creation and indexing flows are implemented in later phases.
pub struct IndexStore {
    state: Mutex<IndexStoreState>,
    /// SEC-203.3: all index paths must be confined to this root.
    allowed_root: std::path::PathBuf,
}

impl IndexStore {
    pub fn new() -> Self {
        Self {
            state: Mutex::new(IndexStoreState {
                db_uri: default_db_uri(),
                initialized: false,
                last_checked_at: None,
                last_error: None,
            }),
            allowed_root: app_storage_root(),
        }
    }

    #[cfg(test)]
    pub fn with_root(allowed_root: std::path::PathBuf) -> Self {
        let default_uri = allowed_root.join("lancedb").to_string_lossy().into_owned();
        Self {
            state: Mutex::new(IndexStoreState {
                db_uri: default_uri,
                initialized: false,
                last_checked_at: None,
                last_error: None,
            }),
            allowed_root,
        }
    }

    pub fn initialize(&self, requested_uri: Option<String>) -> Result<IndexStoreHealth, AppError> {
        let target_uri = if let Some(uri) = requested_uri {
            normalise_uri(&uri)?
        } else {
            let state = self.state.lock().unwrap();
            state.db_uri.clone()
        };

        ensure_local_directory(&target_uri, &self.allowed_root)?;

        match probe_lancedb(&target_uri) {
            Ok(()) => {
                let now = Utc::now();
                let mut state = self.state.lock().unwrap();
                state.db_uri = target_uri.clone();
                state.initialized = true;
                state.last_checked_at = Some(now);
                state.last_error = None;

                Ok(IndexStoreHealth {
                    db_uri: target_uri,
                    initialized: true,
                    reachable: true,
                    last_checked_at: now,
                    last_error: None,
                })
            }
            Err(err) => {
                let now = Utc::now();
                let message = err.frontend_message();
                let mut state = self.state.lock().unwrap();
                state.db_uri = target_uri;
                state.initialized = false;
                state.last_checked_at = Some(now);
                state.last_error = Some(message.clone());
                Err(AppError::Storage(message))
            }
        }
    }

    pub fn health_check(&self) -> IndexStoreHealth {
        let (db_uri, initialized) = {
            let state = self.state.lock().unwrap();
            (state.db_uri.clone(), state.initialized)
        };

        let now = Utc::now();
        let reachable = probe_lancedb(&db_uri).is_ok();

        let mut state = self.state.lock().unwrap();
        state.last_checked_at = Some(now);
        state.last_error = if reachable {
            None
        } else {
            Some("LanceDB connection probe failed".to_string())
        };

        IndexStoreHealth {
            db_uri,
            initialized,
            reachable,
            last_checked_at: now,
            last_error: state.last_error.clone(),
        }
    }

    pub fn current_health(&self) -> IndexStoreHealth {
        let now = Utc::now();
        let mut state = self.state.lock().unwrap();

        let checked_at = state.last_checked_at.unwrap_or(now);

        if state.last_checked_at.is_none() {
            state.last_checked_at = Some(checked_at);
        }

        IndexStoreHealth {
            db_uri: state.db_uri.clone(),
            initialized: state.initialized,
            reachable: false,
            last_checked_at: checked_at,
            last_error: state.last_error.clone(),
        }
    }
}

fn default_db_uri() -> String {
    if let Ok(home) = std::env::var("HOME") {
        return format!("{home}/.product-overlord/lancedb");
    }

    ".product-overlord/lancedb".to_string()
}

fn normalise_uri(raw: &str) -> Result<String, AppError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation(
            "index store URI must not be empty".to_string(),
        ));
    }

    if trimmed.len() > INDEX_URI_MAX_LEN {
        return Err(AppError::Validation(format!(
            "index store URI exceeds maximum length of {INDEX_URI_MAX_LEN} characters"
        )));
    }

    Ok(trimmed.trim_end_matches('/').to_string())
}

fn ensure_local_directory(uri: &str, allowed_root: &std::path::Path) -> Result<(), AppError> {
    // For Phase 1E we support filesystem paths only.
    if uri.contains("://") {
        return Err(AppError::Validation(
            "index store URI must be a local filesystem path in Phase 1E".to_string(),
        ));
    }

    // SEC-203.3: enforce confinement to the app storage root before creating any directory.
    let path = std::path::Path::new(uri);
    enforce_storage_root(path, allowed_root)?;

    fs::create_dir_all(uri)
        .map_err(|err| AppError::Storage(format!("failed to create index directory: {err}")))
}

fn probe_lancedb(uri: &str) -> Result<(), AppError> {
    #[cfg(feature = "lancedb-runtime")]
    {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|err| AppError::Storage(format!("failed to create tokio runtime: {err}")))?;

        return runtime
            .block_on(async {
                lancedb::connect(uri)
                    .execute()
                    .await
                    .map(|_| ())
                    .map_err(|err| AppError::Storage(format!("failed to connect to lancedb: {err}")))
            });
    }

    #[cfg(not(feature = "lancedb-runtime"))]
    {
        // Rust 1.90 host compatibility mode: treat a writable local directory
        // as a healthy index store. Enable the `lancedb-runtime` feature to
        // perform a real LanceDB connection probe.
        if Path::new(uri).exists() {
            return Ok(());
        }

        return Err(AppError::Storage(
            "index store path does not exist".to_string(),
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn new_store_is_uninitialized() {
        let store = IndexStore::new();
        let health = store.current_health();

        assert!(!health.initialized);
        assert!(!health.reachable);
        assert!(health.last_error.is_none());
    }

    #[test]
    fn initialize_rejects_empty_uri() {
        let store = IndexStore::new();
        let err = store.initialize(Some("   ".to_string())).unwrap_err();
        assert!(err.to_string().contains("must not be empty"));
    }

    #[test]
    fn initialize_rejects_remote_uri() {
        let store = IndexStore::new();
        let err = store
            .initialize(Some("s3://bucket/index".to_string()))
            .unwrap_err();
        assert!(err.to_string().contains("filesystem path"));
    }

    #[test]
    fn initialize_local_path_succeeds() {
        // Use with_root so the temp directory is treated as the allowed root.
        let root = std::env::temp_dir().join(format!("product-overlord-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let candidate = root.join("lancedb");
        let uri = candidate.to_string_lossy().to_string();

        let store = IndexStore::with_root(root);
        let health = store.initialize(Some(uri.clone())).unwrap();

        assert!(Path::new(&uri).exists());
        assert!(health.initialized);
        assert!(health.reachable);
        assert_eq!(health.db_uri, uri);
    }

    #[test]
    fn initialize_rejects_path_outside_allowed_root() {
        let root = std::env::temp_dir().join(format!("product-overlord-root-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();

        // A sibling directory is outside the allowed root.
        let sibling = std::env::temp_dir().join(format!("escape-{}", Uuid::new_v4()));
        let uri = sibling.to_string_lossy().to_string();

        let store = IndexStore::with_root(root);
        let err = store.initialize(Some(uri)).unwrap_err();
        assert!(
            err.to_string().contains("outside") || err.to_string().contains("traversal"),
            "expected path-policy error, got: {err}"
        );
    }
}
