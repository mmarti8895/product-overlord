use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// External service / LLM provider a credential entry can represent.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Provider {
    Jira,
    GitHub,
    OpenAi,
    Anthropic,
    Ollama,
    Gemini,
    AtlassianRovo,
}

impl Provider {
    /// Human-readable display name used in audit log and UI labels.
    pub fn display_name(&self) -> &'static str {
        match self {
            Provider::Jira => "Jira",
            Provider::GitHub => "GitHub",
            Provider::OpenAi => "OpenAI",
            Provider::Anthropic => "Anthropic",
            Provider::Ollama => "Ollama",
            Provider::Gemini => "Google Gemini",
            Provider::AtlassianRovo => "Atlassian Rovo",
        }
    }
}

/// Metadata record for a stored integration credential.
///
/// # Security contract
/// This struct MUST NOT contain secret values (API keys, tokens, passwords).
/// Secrets are stored exclusively in the OS keychain (Phase 1C).
/// Only non-sensitive metadata (id, provider, label, timestamps) is held here
/// so it can be safely serialized, logged, and sent to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntegrationCredential {
    /// Stable opaque identifier for this credential entry.
    pub id: Uuid,

    /// Which provider this credential authenticates against.
    pub provider: Provider,

    /// Human-readable label to distinguish multiple entries for the same provider.
    pub label: String,

    /// Optional base URL override (e.g. self-hosted Jira / Ollama endpoint).
    pub base_url: Option<String>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl IntegrationCredential {
    /// Create a new credential metadata record with a freshly generated id.
    pub fn new(provider: Provider, label: impl Into<String>, base_url: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            provider,
            label: label.into(),
            base_url,
            created_at: now,
            updated_at: now,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_credential_has_unique_ids() {
        let a = IntegrationCredential::new(Provider::Jira, "my-jira", None);
        let b = IntegrationCredential::new(Provider::Jira, "my-jira", None);
        assert_ne!(a.id, b.id);
    }

    #[test]
    fn provider_display_names_are_non_empty() {
        let providers = [
            Provider::Jira,
            Provider::GitHub,
            Provider::OpenAi,
            Provider::Anthropic,
            Provider::Ollama,
            Provider::Gemini,
            Provider::AtlassianRovo,
        ];
        for p in &providers {
            assert!(!p.display_name().is_empty());
        }
    }

    #[test]
    fn credential_serde_round_trip() {
        let cred = IntegrationCredential::new(
            Provider::GitHub,
            "my-github",
            Some("https://github.example.com".to_string()),
        );
        let json = serde_json::to_string(&cred).unwrap();
        let decoded: IntegrationCredential = serde_json::from_str(&json).unwrap();
        assert_eq!(cred.id, decoded.id);
        assert_eq!(decoded.provider, Provider::GitHub);
    }
}
