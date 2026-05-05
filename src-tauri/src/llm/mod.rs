use std::collections::HashMap;
use std::sync::Mutex;

use crate::domain::llm::{
    LlmInvocationRequest, LlmInvocationResponse, LlmProvider, LlmProviderConfig,
};
use crate::errors::AppError;
use crate::sync_utils::lock_or_internal;

const PROMPT_MAX_LEN: usize = 16_000;

pub trait LlmClient: Send + Sync {
    fn provider(&self) -> LlmProvider;

    fn invoke(
        &self,
        request: &LlmInvocationRequest,
        config: &LlmProviderConfig,
    ) -> Result<LlmInvocationResponse, AppError>;
}

struct StubClient {
    provider: LlmProvider,
}

impl StubClient {
    fn new(provider: LlmProvider) -> Self {
        Self { provider }
    }
}

impl LlmClient for StubClient {
    fn provider(&self) -> LlmProvider {
        self.provider
    }

    fn invoke(
        &self,
        request: &LlmInvocationRequest,
        config: &LlmProviderConfig,
    ) -> Result<LlmInvocationResponse, AppError> {
        if !config.enabled {
            return Err(AppError::NotConfigured(format!(
                "provider {} is disabled",
                self.provider.display_name()
            )));
        }

        let mut warnings = vec![
            "Phase 1H stub response: live model inference is disabled".to_string(),
        ];

        if config.credential_id.is_none() && self.provider != LlmProvider::Ollama {
            warnings.push("no credential linked yet".to_string());
        }

        Ok(LlmInvocationResponse {
            provider: self.provider,
            model: config.model.clone(),
            output: format!(
                "[stub:{}] prompt accepted ({} chars)",
                request.provider.display_name(),
                request.prompt.len()
            ),
            simulated: true,
            warnings,
        })
    }
}

pub struct LlmGateway {
    configs: Mutex<HashMap<LlmProvider, LlmProviderConfig>>,
    clients: HashMap<LlmProvider, Box<dyn LlmClient>>,
}

impl LlmGateway {
    pub fn new() -> Self {
        let clients: HashMap<LlmProvider, Box<dyn LlmClient>> = [
            LlmProvider::OpenAi,
            LlmProvider::Anthropic,
            LlmProvider::Ollama,
            LlmProvider::Gemini,
            LlmProvider::AtlassianRovo,
        ]
        .into_iter()
        .map(|provider| {
            (
                provider,
                Box::new(StubClient::new(provider)) as Box<dyn LlmClient>,
            )
        })
        .collect();

        Self {
            configs: Mutex::new(HashMap::new()),
            clients,
        }
    }

    pub fn configure_provider(
        &self,
        mut config: LlmProviderConfig,
    ) -> Result<LlmProviderConfig, AppError> {
        config.model = config.model.trim().to_string();

        if config.model.is_empty() {
            return Err(AppError::Validation(
                "LLM model must not be empty".to_string(),
            ));
        }

        if let Some(base_url) = &config.base_url {
            let trimmed = base_url.trim();
            config.base_url = if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            };
        }

        lock_or_internal(&self.configs, "llm_gateway")?
            .insert(config.provider, config.clone());

        Ok(config)
    }

    pub fn list_provider_configs(&self) -> Result<Vec<LlmProviderConfig>, AppError> {
        let mut out: Vec<LlmProviderConfig> =
            lock_or_internal(&self.configs, "llm_gateway")?.values().cloned().collect();
        out.sort_by_key(|cfg| cfg.provider.display_name());
        Ok(out)
    }

    pub fn invoke(&self, request: LlmInvocationRequest) -> Result<LlmInvocationResponse, AppError> {
        let prompt = request.prompt.trim();
        if prompt.is_empty() {
            return Err(AppError::Validation("LLM prompt must not be empty".to_string()));
        }
        if prompt.len() > PROMPT_MAX_LEN {
            return Err(AppError::Validation(format!(
                "LLM prompt exceeds maximum length of {PROMPT_MAX_LEN} characters"
            )));
        }

        let config = lock_or_internal(&self.configs, "llm_gateway")?
            .get(&request.provider)
            .cloned()
            .ok_or_else(|| {
                AppError::NotConfigured(format!(
                    "provider {} is not configured",
                    request.provider.display_name()
                ))
            })?;

        let client = self.clients.get(&request.provider).ok_or_else(|| {
            AppError::Internal(anyhow::anyhow!(
                "no LLM client registered for provider {:?}",
                request.provider
            ))
        })?;

        client.invoke(&request, &config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configure_provider_rejects_blank_model() {
        let gateway = LlmGateway::new();
        let err = gateway
            .configure_provider(LlmProviderConfig {
                provider: LlmProvider::OpenAi,
                model: "   ".to_string(),
                base_url: None,
                credential_id: None,
                enabled: true,
            })
            .unwrap_err();

        assert!(err.to_string().contains("model"));
    }

    #[test]
    fn configured_provider_appears_in_list() {
        let gateway = LlmGateway::new();
        gateway
            .configure_provider(LlmProviderConfig {
                provider: LlmProvider::OpenAi,
                model: "gpt-4o-mini".to_string(),
                base_url: Some("https://api.openai.com".to_string()),
                credential_id: None,
                enabled: true,
            })
            .unwrap();

        let listed = gateway.list_provider_configs().unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].provider, LlmProvider::OpenAi);
    }

    #[test]
    fn invoke_requires_configuration() {
        let gateway = LlmGateway::new();
        let err = gateway
            .invoke(LlmInvocationRequest {
                provider: LlmProvider::Anthropic,
                prompt: "hello".to_string(),
                system_prompt: None,
                max_tokens: None,
                temperature: None,
            })
            .unwrap_err();

        assert!(err.to_string().contains("not configured"));
    }

    #[test]
    fn invoke_returns_stub_output_when_configured() {
        let gateway = LlmGateway::new();
        gateway
            .configure_provider(LlmProviderConfig {
                provider: LlmProvider::Ollama,
                model: "llama3.1".to_string(),
                base_url: Some("http://localhost:11434".to_string()),
                credential_id: None,
                enabled: true,
            })
            .unwrap();

        let response = gateway
            .invoke(LlmInvocationRequest {
                provider: LlmProvider::Ollama,
                prompt: "Summarize the ticket.".to_string(),
                system_prompt: None,
                max_tokens: Some(256),
                temperature: Some(0.2),
            })
            .unwrap();

        assert!(response.simulated);
        assert!(response.output.contains("stub"));
    }
}
