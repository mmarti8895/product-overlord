use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Outbound delivery channel for a notification.
/// Channels are additive — a rule may fan out to multiple channels.
/// No channel is active unless the rule is enabled AND the channel is listed.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NotificationChannel {
    Slack,
    MicrosoftTeams,
    Email,
    Webhook,
}

impl NotificationChannel {
    pub fn display_name(&self) -> &'static str {
        match self {
            NotificationChannel::Slack => "Slack",
            NotificationChannel::MicrosoftTeams => "Microsoft Teams",
            NotificationChannel::Email => "Email",
            NotificationChannel::Webhook => "Webhook",
        }
    }
}

/// Criteria that must all match for a notification to fire.
/// An empty/default filter matches everything — rules should be explicit.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NotificationFilter {
    /// Only fire for tickets with these status values (empty = all statuses).
    pub ticket_statuses: Vec<String>,

    /// Only fire for tickets assigned to these users (empty = any assignee).
    pub assignees: Vec<String>,

    /// Only fire for tickets with these labels (empty = any labels).
    pub labels: Vec<String>,

    /// Only fire if the JQL matches the ticket (empty = no JQL constraint).
    /// Validated syntactically in Phase 1D before storage.
    pub jql_filter: Option<String>,
}

/// A notification rule: when conditions match, fan out to the listed channels.
///
/// # Safety invariant
/// A rule MUST be `enabled = true` AND have at least one entry in `channels`
/// before any outbound notification may be sent.  The engine must enforce this
/// before dispatching (Phase 1K hardening).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationRule {
    /// Stable opaque identifier.
    pub id: Uuid,

    /// Human-readable name shown in the rules list.
    pub name: String,

    /// Brief description of the rule's purpose.
    pub description: Option<String>,

    /// Whether the rule is active.  Default: false (deny-by-default).
    pub enabled: bool,

    /// Delivery channels.  Must be non-empty for the rule to send anything.
    pub channels: Vec<NotificationChannel>,

    /// Match criteria.
    pub filter: NotificationFilter,
}

impl NotificationRule {
    /// Create a new disabled rule with no channels — safe initial state.
    pub fn new(name: impl Into<String>, description: Option<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            description,
            enabled: false,        // deny-by-default
            channels: vec![],      // no delivery until explicitly configured
            filter: NotificationFilter::default(),
        }
    }

    /// Returns `true` only when the rule can actually fire:
    /// enabled AND at least one channel configured.
    pub fn can_fire(&self) -> bool {
        self.enabled && !self.channels.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_rule_is_disabled_by_default() {
        let rule = NotificationRule::new("on-blocker", None);
        assert!(!rule.enabled);
        assert!(rule.channels.is_empty());
        assert!(!rule.can_fire());
    }

    #[test]
    fn rule_cannot_fire_without_channels() {
        let mut rule = NotificationRule::new("alert", None);
        rule.enabled = true;
        assert!(!rule.can_fire(), "enabled but empty channels must not fire");
    }

    #[test]
    fn rule_can_fire_when_enabled_and_has_channel() {
        let mut rule = NotificationRule::new("alert", None);
        rule.enabled = true;
        rule.channels.push(NotificationChannel::Slack);
        assert!(rule.can_fire());
    }

    #[test]
    fn rule_serde_round_trip() {
        let mut rule = NotificationRule::new("test", Some("desc".to_string()));
        rule.channels.push(NotificationChannel::Email);
        let json = serde_json::to_string(&rule).unwrap();
        let decoded: NotificationRule = serde_json::from_str(&json).unwrap();
        assert_eq!(rule.id, decoded.id);
        assert_eq!(decoded.channels, vec![NotificationChannel::Email]);
    }
}
