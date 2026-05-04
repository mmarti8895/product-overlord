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
