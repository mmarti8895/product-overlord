use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A single Definition of Ready checklist item.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DorChecklistItem {
    pub id: Uuid,
    pub title: String,
    pub required: bool,
    pub done: bool,
}

impl DorChecklistItem {
    pub fn new(title: impl Into<String>, required: bool) -> Self {
        Self {
            id: Uuid::new_v4(),
            title: title.into(),
            required,
            done: false,
        }
    }
}

/// Coarse effort band used during ticket triage.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EffortBand {
    Trivial,
    Small,
    Medium,
    Large,
    XLarge,
}

/// Planning estimate attached to a ticket scaffold.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffortEstimate {
    pub band: EffortBand,
    pub story_points: Option<f32>,
    pub confidence: u8,
    pub rationale: Option<String>,
}

/// Ticket planning scaffold containing DoR, AC, and effort estimate.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicketScaffold {
    pub ticket_key: String,
    pub definition_of_ready: Vec<DorChecklistItem>,
    pub acceptance_criteria: Vec<String>,
    pub effort_estimate: Option<EffortEstimate>,
    pub updated_at: DateTime<Utc>,
}

impl TicketScaffold {
    pub fn new(ticket_key: impl Into<String>) -> Self {
        let now = Utc::now();
        Self {
            ticket_key: ticket_key.into(),
            definition_of_ready: default_dor_template(),
            acceptance_criteria: Vec::new(),
            effort_estimate: None,
            updated_at: now,
        }
    }

    pub fn dor_completion_ratio(&self) -> f32 {
        let required_items: Vec<&DorChecklistItem> = self
            .definition_of_ready
            .iter()
            .filter(|item| item.required)
            .collect();

        if required_items.is_empty() {
            return 1.0;
        }

        let done = required_items.iter().filter(|item| item.done).count() as f32;
        done / required_items.len() as f32
    }

    pub fn is_ready_for_review(&self) -> bool {
        self.dor_completion_ratio() >= 1.0 && !self.acceptance_criteria.is_empty()
    }
}

fn default_dor_template() -> Vec<DorChecklistItem> {
    vec![
        DorChecklistItem::new("Problem statement is clear", true),
        DorChecklistItem::new("Dependencies are identified", true),
        DorChecklistItem::new("Acceptance criteria drafted", true),
        DorChecklistItem::new("Risk notes captured", false),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_scaffold_has_default_dor_items() {
        let scaffold = TicketScaffold::new("PROJ-101");
        assert!(!scaffold.definition_of_ready.is_empty());
        assert_eq!(scaffold.acceptance_criteria.len(), 0);
        assert!(scaffold.effort_estimate.is_none());
    }

    #[test]
    fn readiness_requires_required_dor_and_acceptance_criteria() {
        let mut scaffold = TicketScaffold::new("PROJ-2");
        assert!(!scaffold.is_ready_for_review());

        for item in &mut scaffold.definition_of_ready {
            if item.required {
                item.done = true;
            }
        }

        assert!(!scaffold.is_ready_for_review());

        scaffold.acceptance_criteria.push("User can save settings".to_string());
        assert!(scaffold.is_ready_for_review());
    }

    #[test]
    fn effort_estimate_serde_round_trip() {
        let estimate = EffortEstimate {
            band: EffortBand::Medium,
            story_points: Some(5.0),
            confidence: 80,
            rationale: Some("Touches 2 services".to_string()),
        };

        let json = serde_json::to_string(&estimate).unwrap();
        let decoded: EffortEstimate = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.band, EffortBand::Medium);
        assert_eq!(decoded.story_points, Some(5.0));
        assert_eq!(decoded.confidence, 80);
    }
}
