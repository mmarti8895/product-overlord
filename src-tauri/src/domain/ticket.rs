use serde::{Deserialize, Serialize};

/// Workflow status of a Jira ticket.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TicketStatus {
    Backlog,
    Todo,
    InProgress,
    InReview,
    Done,
    Blocked,
    Cancelled,
}

impl TicketStatus {
    pub fn display_label(&self) -> &'static str {
        match self {
            TicketStatus::Backlog => "Backlog",
            TicketStatus::Todo => "To Do",
            TicketStatus::InProgress => "In Progress",
            TicketStatus::InReview => "In Review",
            TicketStatus::Done => "Done",
            TicketStatus::Blocked => "Blocked",
            TicketStatus::Cancelled => "Cancelled",
        }
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, TicketStatus::Done | TicketStatus::Cancelled)
    }
}

/// Priority level of a Jira ticket.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TicketPriority {
    Low,
    Medium,
    High,
    Critical,
}

impl TicketPriority {
    pub fn display_label(&self) -> &'static str {
        match self {
            TicketPriority::Low => "Low",
            TicketPriority::Medium => "Medium",
            TicketPriority::High => "High",
            TicketPriority::Critical => "Critical",
        }
    }
}

/// Read-only snapshot of a Jira ticket fetched for review purposes.
///
/// # Security note
/// All string fields (summary, description, comments) arrive from an external
/// system and must be treated as untrusted.  Sanitize before rendering in the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JiraTicket {
    /// Jira issue key, e.g. "PROJ-123".
    pub key: String,

    /// Issue summary line (untrusted external content — sanitize before display).
    pub summary: String,

    /// Long-form description (untrusted external content — sanitize before display).
    pub description: Option<String>,

    pub status: TicketStatus,
    pub priority: TicketPriority,

    /// Story point estimate if set.
    pub story_points: Option<f32>,

    /// Assignee display name.
    pub assignee: Option<String>,

    /// Reporter display name.
    pub reporter: Option<String>,

    /// Issue labels.
    pub labels: Vec<String>,
}

/// Input to a ticket review session.
/// Phase 1 only scaffolds the types — no live Jira calls or LLM invocations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicketReviewRequest {
    /// The Jira issue key to review, e.g. "PROJ-123".
    pub ticket_key: String,

    /// Whether to incorporate repository context from the local index.
    pub include_repository_context: bool,

    /// Optional explicit list of repository ids to consult (empty = all indexed).
    pub repository_ids: Vec<uuid::Uuid>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn done_and_cancelled_are_terminal() {
        assert!(TicketStatus::Done.is_terminal());
        assert!(TicketStatus::Cancelled.is_terminal());
        assert!(!TicketStatus::InProgress.is_terminal());
    }

    #[test]
    fn priority_ordering() {
        assert!(TicketPriority::Critical > TicketPriority::High);
        assert!(TicketPriority::High > TicketPriority::Medium);
        assert!(TicketPriority::Medium > TicketPriority::Low);
    }

    #[test]
    fn ticket_serde_round_trip() {
        let ticket = JiraTicket {
            key: "PROJ-1".to_string(),
            summary: "Fix login bug".to_string(),
            description: None,
            status: TicketStatus::InProgress,
            priority: TicketPriority::High,
            story_points: Some(3.0),
            assignee: Some("alice".to_string()),
            reporter: Some("bob".to_string()),
            labels: vec!["auth".to_string()],
        };
        let json = serde_json::to_string(&ticket).unwrap();
        let decoded: JiraTicket = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.key, "PROJ-1");
        assert_eq!(decoded.status, TicketStatus::InProgress);
    }

    #[test]
    fn review_request_serde_round_trip() {
        let req = TicketReviewRequest {
            ticket_key: "PROJ-42".to_string(),
            include_repository_context: true,
            repository_ids: vec![],
        };
        let json = serde_json::to_string(&req).unwrap();
        let decoded: TicketReviewRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.ticket_key, "PROJ-42");
    }
}
