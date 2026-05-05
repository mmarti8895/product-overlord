use std::collections::HashMap;
use std::sync::Mutex;

use chrono::Utc;
use uuid::Uuid;

use crate::domain::scaffolding::{EffortEstimate, TicketScaffold};
use crate::errors::AppError;
use crate::sync_utils::lock_or_internal;

const TICKET_KEY_MAX_LEN: usize = 64;
const ACCEPTANCE_CRITERIA_MAX_ITEMS: usize = 30;
const ACCEPTANCE_CRITERION_MAX_LEN: usize = 500;

/// In-memory store for ticket scaffolding metadata.
///
/// Persistence is intentionally deferred in Phase 1I.
pub struct ScaffoldStore {
    scaffolds: Mutex<HashMap<String, TicketScaffold>>,
}

impl ScaffoldStore {
    pub fn new() -> Self {
        Self {
            scaffolds: Mutex::new(HashMap::new()),
        }
    }

    pub fn create(&self, ticket_key: String) -> Result<TicketScaffold, AppError> {
        let key = normalize_ticket_key(&ticket_key)?;

        let mut guard = lock_or_internal(&self.scaffolds, "scaffold_store")?;
        if guard.contains_key(&key) {
            return Err(AppError::Validation(format!(
                "ticket scaffold already exists for {key}"
            )));
        }

        let scaffold = TicketScaffold::new(key.clone());
        guard.insert(key, scaffold.clone());
        Ok(scaffold)
    }

    pub fn get(&self, ticket_key: String) -> Result<Option<TicketScaffold>, AppError> {
        let key = normalize_ticket_key(&ticket_key)?;
        Ok(lock_or_internal(&self.scaffolds, "scaffold_store")?.get(&key).cloned())
    }

    pub fn list(&self) -> Result<Vec<TicketScaffold>, AppError> {
        let mut out: Vec<TicketScaffold> =
            lock_or_internal(&self.scaffolds, "scaffold_store")?.values().cloned().collect();
        out.sort_by(|a, b| a.ticket_key.cmp(&b.ticket_key));
        Ok(out)
    }

    pub fn set_dor_item_status(
        &self,
        ticket_key: String,
        item_id: Uuid,
        done: bool,
    ) -> Result<TicketScaffold, AppError> {
        let key = normalize_ticket_key(&ticket_key)?;
        let mut guard = lock_or_internal(&self.scaffolds, "scaffold_store")?;
        let scaffold = guard
            .get_mut(&key)
            .ok_or_else(|| AppError::NotConfigured(format!("ticket scaffold not found: {key}")))?;

        let item = scaffold
            .definition_of_ready
            .iter_mut()
            .find(|item| item.id == item_id)
            .ok_or_else(|| {
                AppError::Validation(format!("dor item not found for ticket {key}: {item_id}"))
            })?;

        item.done = done;
        scaffold.updated_at = Utc::now();

        Ok(scaffold.clone())
    }

    pub fn set_acceptance_criteria(
        &self,
        ticket_key: String,
        criteria: Vec<String>,
    ) -> Result<TicketScaffold, AppError> {
        if criteria.len() > ACCEPTANCE_CRITERIA_MAX_ITEMS {
            return Err(AppError::Validation(format!(
                "acceptance criteria exceeds maximum item count of {ACCEPTANCE_CRITERIA_MAX_ITEMS}"
            )));
        }

        let cleaned: Vec<String> = criteria
            .into_iter()
            .map(|item| item.trim().to_string())
            .filter(|item| !item.is_empty())
            .collect();

        if cleaned
            .iter()
            .any(|item| item.len() > ACCEPTANCE_CRITERION_MAX_LEN)
        {
            return Err(AppError::Validation(format!(
                "acceptance criterion exceeds maximum length of {ACCEPTANCE_CRITERION_MAX_LEN}"
            )));
        }

        let key = normalize_ticket_key(&ticket_key)?;
        let mut guard = lock_or_internal(&self.scaffolds, "scaffold_store")?;
        let scaffold = guard
            .get_mut(&key)
            .ok_or_else(|| AppError::NotConfigured(format!("ticket scaffold not found: {key}")))?;

        scaffold.acceptance_criteria = cleaned;
        scaffold.updated_at = Utc::now();

        Ok(scaffold.clone())
    }

    pub fn set_effort_estimate(
        &self,
        ticket_key: String,
        estimate: EffortEstimate,
    ) -> Result<TicketScaffold, AppError> {
        if estimate.confidence > 100 {
            return Err(AppError::Validation(
                "effort estimate confidence must be between 0 and 100".to_string(),
            ));
        }

        if let Some(points) = estimate.story_points {
            if points < 0.0 {
                return Err(AppError::Validation(
                    "story points must be non-negative".to_string(),
                ));
            }
        }

        let key = normalize_ticket_key(&ticket_key)?;
        let mut guard = lock_or_internal(&self.scaffolds, "scaffold_store")?;
        let scaffold = guard
            .get_mut(&key)
            .ok_or_else(|| AppError::NotConfigured(format!("ticket scaffold not found: {key}")))?;

        scaffold.effort_estimate = Some(estimate);
        scaffold.updated_at = Utc::now();

        Ok(scaffold.clone())
    }
}

fn normalize_ticket_key(raw: &str) -> Result<String, AppError> {
    let key = raw.trim().to_uppercase();
    if key.is_empty() {
        return Err(AppError::Validation(
            "ticket key must not be empty".to_string(),
        ));
    }
    if key.len() > TICKET_KEY_MAX_LEN {
        return Err(AppError::Validation(format!(
            "ticket key exceeds maximum length of {TICKET_KEY_MAX_LEN}"
        )));
    }

    if !key.contains('-') || key.starts_with('-') || key.ends_with('-') {
        return Err(AppError::Validation(
            "ticket key must match PROJECT-123 style format".to_string(),
        ));
    }

    if !key
        .chars()
        .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '-')
    {
        return Err(AppError::Validation(
            "ticket key contains invalid characters".to_string(),
        ));
    }

    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::scaffolding::{EffortBand, EffortEstimate};

    #[test]
    fn create_and_get_scaffold() {
        let store = ScaffoldStore::new();
        let created = store.create("proj-123".to_string()).unwrap();
        assert_eq!(created.ticket_key, "PROJ-123");

        let fetched = store.get("PROJ-123".to_string()).unwrap().unwrap();
        assert_eq!(fetched.ticket_key, "PROJ-123");
    }

    #[test]
    fn cannot_create_duplicate_scaffold() {
        let store = ScaffoldStore::new();
        store.create("PROJ-1".to_string()).unwrap();
        assert!(store.create("proj-1".to_string()).is_err());
    }

    #[test]
    fn set_acceptance_criteria_filters_empty_items() {
        let store = ScaffoldStore::new();
        store.create("PROJ-2".to_string()).unwrap();

        let updated = store
            .set_acceptance_criteria(
                "PROJ-2".to_string(),
                vec!["A".to_string(), "  ".to_string(), "B".to_string()],
            )
            .unwrap();

        assert_eq!(updated.acceptance_criteria, vec!["A", "B"]);
    }

    #[test]
    fn confidence_over_100_is_rejected() {
        let store = ScaffoldStore::new();
        store.create("PROJ-9".to_string()).unwrap();

        let err = store
            .set_effort_estimate(
                "PROJ-9".to_string(),
                EffortEstimate {
                    band: EffortBand::Large,
                    story_points: Some(8.0),
                    confidence: 120,
                    rationale: None,
                },
            )
            .unwrap_err();

        assert!(err.to_string().contains("confidence"));
    }

    #[test]
    fn malformed_ticket_key_is_rejected() {
        let store = ScaffoldStore::new();
        assert!(store.create("proj 123".to_string()).is_err());
        assert!(store.create("-123".to_string()).is_err());
        assert!(store.create("PROJ123".to_string()).is_err());
    }
}
