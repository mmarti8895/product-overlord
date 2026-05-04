use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Supported LLM providers for Phase 1.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LlmProvider {
    OpenAi,
    Anthropic,
    Ollama,
    Gemini,
    AtlassianRovo,
}

impl LlmProvider {
    pub fn display_name(&self) -> &'static str {
        match self {
            LlmProvider::OpenAi => "OpenAI",
            LlmProvider::Anthropic => "Anthropic",
            LlmProvider::Ollama => "Ollama",
            LlmProvider::Gemini => "Google Gemini",
            LlmProvider::AtlassianRovo => "Atlassian Rovo",
        }
    }
}

/// Non-secret provider configuration.
///
/// Secrets are referenced by credential id and remain in the OS keychain.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmProviderConfig {
    pub provider: LlmProvider,
    pub model: String,
    pub base_url: Option<String>,
    pub credential_id: Option<Uuid>,
    pub enabled: bool,
}

/// Request payload for LLM invocation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmInvocationRequest {
    pub provider: LlmProvider,
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

/// Invocation result for UI consumption.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmInvocationResponse {
    pub provider: LlmProvider,
    pub model: String,
    pub output: String,
    pub simulated: bool,
    pub warnings: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_display_names_are_non_empty() {
        let providers = [
            LlmProvider::OpenAi,
            LlmProvider::Anthropic,
            LlmProvider::Ollama,
            LlmProvider::Gemini,
            LlmProvider::AtlassianRovo,
        ];

        for provider in providers {
            assert!(!provider.display_name().is_empty());
        }
    }

    #[test]
    fn config_serde_round_trip() {
        let cfg = LlmProviderConfig {
            provider: LlmProvider::OpenAi,
            model: "gpt-4o-mini".to_string(),
            base_url: Some("https://api.openai.com".to_string()),
            credential_id: None,
            enabled: true,
        };

        let json = serde_json::to_string(&cfg).unwrap();
        let decoded: LlmProviderConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(decoded.provider, LlmProvider::OpenAi);
        assert_eq!(decoded.model, "gpt-4o-mini");
        assert!(decoded.enabled);
    }
}
