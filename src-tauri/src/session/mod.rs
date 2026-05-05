use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};

use crate::domain::permission::Role;

/// Runtime-local authenticated session state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub principal_id: Option<String>,
    pub role: Option<Role>,
    pub issued_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub unlocked: bool,
}

impl SessionState {
    pub fn locked() -> Self {
        Self {
            principal_id: None,
            role: None,
            issued_at: None,
            expires_at: None,
            unlocked: false,
        }
    }

    pub fn unlocked(principal_id: String, role: Role, ttl_minutes: i64) -> Self {
        let issued_at = Utc::now();
        let ttl = ttl_minutes.max(1);
        Self {
            principal_id: Some(principal_id),
            role: Some(role),
            issued_at: Some(issued_at),
            expires_at: Some(issued_at + Duration::minutes(ttl)),
            unlocked: true,
        }
    }

    pub fn is_expired(&self, now: DateTime<Utc>) -> bool {
        if !self.unlocked {
            return true;
        }

        match self.expires_at {
            Some(expires_at) => now >= expires_at,
            None => true,
        }
    }
}

/// Frontend-safe projection of session state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStatus {
    pub unlocked: bool,
    pub principal_id: Option<String>,
    pub role: Option<Role>,
    pub issued_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub expired: bool,
}

/// Lightweight session manager used by command handlers.
#[derive(Debug, Clone)]
pub struct SessionManager {
    state: SessionState,
}

impl SessionManager {
    pub fn new_locked() -> Self {
        Self {
            state: SessionState::locked(),
        }
    }

    pub fn from_state(state: SessionState) -> Self {
        Self { state }
    }

    pub fn lock(&mut self) {
        self.state = SessionState::locked();
    }

    pub fn unlock_stub(&mut self, principal_id: String, role: Role, ttl_minutes: i64) {
        self.state = SessionState::unlocked(principal_id, role, ttl_minutes);
    }

    /// Update the role on an active session without resetting the TTL.
    ///
    /// Has no effect when the session is locked.
    pub fn set_role(&mut self, role: Role) {
        if self.state.unlocked {
            self.state.role = Some(role);
        }
    }

    pub fn current_role(&self) -> Option<Role> {
        self.state.role.clone()
    }

    pub fn status(&self) -> SessionStatus {
        let now = Utc::now();
        SessionStatus {
            unlocked: self.state.unlocked,
            principal_id: self.state.principal_id.clone(),
            role: self.state.role.clone(),
            issued_at: self.state.issued_at,
            expires_at: self.state.expires_at,
            expired: self.state.is_expired(now),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locked_session_is_expired() {
        let state = SessionState::locked();
        assert!(state.is_expired(Utc::now()));
    }

    #[test]
    fn unlocked_session_has_role() {
        let mut manager = SessionManager::new_locked();
        manager.unlock_stub("desktop-user".to_string(), Role::Operator, 30);
        assert_eq!(manager.current_role(), Some(Role::Operator));
        assert!(manager.status().unlocked);
    }
}
