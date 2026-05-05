use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Current state of a repository's vector index.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IndexStatus {
    /// Repository has never been indexed.
    NotIndexed,
    /// Indexing is currently in progress.
    Indexing,
    /// Index is up to date.
    Indexed,
    /// Last indexing attempt failed; message contains sanitized reason.
    Error(String),
}

impl IndexStatus {
    pub fn is_ready(&self) -> bool {
        matches!(self, IndexStatus::Indexed)
    }

    pub fn display_label(&self) -> &str {
        match self {
            IndexStatus::NotIndexed => "Not Indexed",
            IndexStatus::Indexing => "Indexing…",
            IndexStatus::Indexed => "Indexed",
            IndexStatus::Error(_) => "Error",
        }
    }
}

/// Metadata for a repository that may be indexed for context retrieval.
///
/// # Security note
/// `path` is a local filesystem path stored for internal use only.
/// It must never be passed to the frontend raw — use `name` for display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepositoryContext {
    /// Stable opaque identifier.
    pub id: Uuid,

    /// Display name shown in the UI.
    pub name: String,

    /// Absolute local path to the repository root.
    /// Internal use only — not safe to expose to the frontend.
    pub path: String,

    /// Current indexing state.
    pub index_status: IndexStatus,

    /// When the index was last successfully completed.
    pub last_indexed_at: Option<DateTime<Utc>>,

    /// Approximate number of chunks in the index (informational).
    pub chunk_count: Option<u64>,
}

impl RepositoryContext {
    /// Create a new unindexed repository context.
    pub fn new(name: impl Into<String>, path: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            path: path.into(),
            index_status: IndexStatus::NotIndexed,
            last_indexed_at: None,
            chunk_count: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_repo_is_not_indexed() {
        let repo = RepositoryContext::new("my-repo", "/home/user/repos/my-repo");
        assert_eq!(repo.index_status, IndexStatus::NotIndexed);
        assert!(!repo.index_status.is_ready());
        assert!(repo.last_indexed_at.is_none());
    }

    #[test]
    fn indexed_status_is_ready() {
        let mut repo = RepositoryContext::new("r", "/r");
        repo.index_status = IndexStatus::Indexed;
        assert!(repo.index_status.is_ready());
    }

    #[test]
    fn error_status_is_not_ready() {
        let status = IndexStatus::Error("disk full".to_string());
        assert!(!status.is_ready());
    }

    #[test]
    fn repo_serde_round_trip() {
        let repo = RepositoryContext::new("acme", "/repos/acme");
        let json = serde_json::to_string(&repo).unwrap();
        let decoded: RepositoryContext = serde_json::from_str(&json).unwrap();
        assert_eq!(repo.id, decoded.id);
        assert_eq!(decoded.index_status, IndexStatus::NotIndexed);
    }
}
