use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Who or what initiated an auditable action.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum AuditActor {
    /// Human user via the desktop UI.
    User { name: String },
    /// Autonomous agent action initiated by the AI PM engine.
    Agent { name: String },
    /// System-level operation (startup, migration, cleanup).
    System,
}

/// Discrete actions tracked in the append-only audit log.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditAction {
    // Credential lifecycle
    CredentialAdded,
    CredentialDeleted,
    CredentialHealthChecked,

    // Notification rules
    NotificationRuleCreated,
    NotificationRuleUpdated,
    NotificationRuleDeleted,

    // Repository index
    RepositoryIndexRequested,
    RepositoryIndexCompleted,
    RepositoryIndexFailed,

    // Permission / access control
    PermissionDenied,
    RoleAssigned,

    // Jira (suggest-only — no write actions allowed in Phase 1)
    JiraTicketReviewed,

    // LLM
    LlmProviderConfigured,
    LlmInvoked,

    // Audit
    AuditLogExported,

    // System
    AppStarted,
    AppShutdown,
    ConfigurationChanged,
}

/// A single immutable record in the append-only audit log.
///
/// Entries must never be updated or deleted after creation.
/// The `details` field must contain only sanitized, non-secret content.
///
/// ## Hash chain (SEC-204)
///
/// When written by `AuditStore::append`, three optional fields are set:
/// - `chain_version`: always `1` for records written by this implementation.
/// - `prev_hash`:     hex-SHA-256 of the previous entry (empty string for entry #0).
/// - `entry_hash`:    hex-SHA-256 of `prev_hash || canonical_json_without_hash_fields`.
///
/// Records read from a log written by an older version of the app may have
/// all three fields absent — the verifier treats them as unchained legacy
/// entries and reports them separately.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    /// Stable opaque identifier for this log entry.
    pub id: Uuid,

    /// The action that was performed.
    pub action: AuditAction,

    /// Who or what performed the action.
    pub actor: AuditActor,

    /// When the action occurred (always UTC).
    pub timestamp: DateTime<Utc>,

    /// Optional structured context. Must NOT contain secrets or credential values.
    pub details: Option<String>,

    /// Optional correlation id to link related entries (e.g. a review session).
    pub correlation_id: Option<Uuid>,

    // ── SEC-204 chain fields ───────────────────────────────────────────────
    /// Chain format version. `1` for all entries written by this implementation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chain_version: Option<u8>,

    /// Hex-SHA-256 of the previous entry's `entry_hash`.
    /// Empty string `""` for the first entry in the log.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prev_hash: Option<String>,

    /// Hex-SHA-256 of `prev_hash || canonical_json_without_chain_fields`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry_hash: Option<String>,
}

/// Result of a full audit-chain integrity scan.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditIntegrityReport {
    /// True only when every chained entry's hash is valid and the chain is
    /// unbroken from first to last.
    pub ok: bool,

    /// Total number of entries scanned (including legacy unchained entries).
    pub total_entries: usize,

    /// Number of entries that carry chain fields (chain_version is Some).
    pub chained_entries: usize,

    /// 1-based line number of the first invalid or missing chain link.
    /// `None` when `ok` is true.
    pub first_invalid_line: Option<usize>,

    /// Human-readable reason for the first failure.
    /// `None` when `ok` is true.
    pub reason: Option<String>,
}

impl AuditLogEntry {
    /// Construct a new audit entry with a freshly generated id and current timestamp.
    pub fn new(
        action: AuditAction,
        actor: AuditActor,
        details: Option<String>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            action,
            actor,
            timestamp: Utc::now(),
            details,
            correlation_id: None,
            chain_version: None,
            prev_hash: None,
            entry_hash: None,
        }
    }

    /// Attach a correlation id to group related entries.
    pub fn with_correlation(mut self, correlation_id: Uuid) -> Self {
        self.correlation_id = Some(correlation_id);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_entry_has_unique_ids() {
        let a = AuditLogEntry::new(AuditAction::AppStarted, AuditActor::System, None);
        let b = AuditLogEntry::new(AuditAction::AppStarted, AuditActor::System, None);
        assert_ne!(a.id, b.id);
    }

    #[test]
    fn correlation_id_is_attached() {
        let corr = Uuid::new_v4();
        let entry = AuditLogEntry::new(AuditAction::JiraTicketReviewed, AuditActor::System, None)
            .with_correlation(corr);
        assert_eq!(entry.correlation_id, Some(corr));
    }

    #[test]
    fn audit_entry_serde_round_trip() {
        let entry = AuditLogEntry::new(
            AuditAction::CredentialAdded,
            AuditActor::User { name: "alice".to_string() },
            Some("jira credential".to_string()),
        );
        let json = serde_json::to_string(&entry).unwrap();
        let decoded: AuditLogEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(entry.id, decoded.id);
    }
}
