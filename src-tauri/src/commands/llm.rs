use tauri::State;

use crate::commands::audit::append_user_audit;
use crate::commands::authz::require_permission;
use crate::domain::audit::AuditAction;
use crate::domain::llm::{
    LlmInvocationRequest, LlmInvocationResponse, LlmProviderConfig,
};
use crate::domain::permission::Permission;
use crate::errors::AppError;
use crate::state::AppState;
use crate::validation::validate_base_url;

#[tauri::command]
pub fn cmd_configure_llm_provider(
    state: State<'_, AppState>,
    config: LlmProviderConfig,
) -> Result<LlmProviderConfig, AppError> {
    require_permission(&state, Permission::ConfigureLlmProvider, "configure_llm_provider")?;

    let normalized_config = LlmProviderConfig {
        base_url: match config.base_url {
            Some(url) => Some(validate_base_url(&url)?.normalised),
            None => None,
        },
        ..config
    };

    let configured = state.llm_gateway.configure_provider(normalized_config)?;

    append_user_audit(
        &state,
        AuditAction::LlmProviderConfigured,
        Some(format!(
            "provider={}, model={}, enabled={}",
            configured.provider.display_name(),
            configured.model,
            configured.enabled
        )),
    )?;

    Ok(configured)
}

#[tauri::command]
pub fn cmd_list_llm_provider_configs(
    state: State<'_, AppState>,
) -> Result<Vec<LlmProviderConfig>, AppError> {
    require_permission(
        &state,
        Permission::ConfigureLlmProvider,
        "list_llm_provider_configs",
    )?;

    Ok(state.llm_gateway.list_provider_configs())
}

#[tauri::command]
pub fn cmd_invoke_llm(
    state: State<'_, AppState>,
    request: LlmInvocationRequest,
) -> Result<LlmInvocationResponse, AppError> {
    require_permission(&state, Permission::InvokeLlm, "invoke_llm")?;

    let provider_name = request.provider.display_name().to_string();
    let response = state.llm_gateway.invoke(request)?;

    append_user_audit(
        &state,
        AuditAction::LlmInvoked,
        Some(format!(
            "provider={}, model={}, simulated={}",
            provider_name,
            response.model,
            response.simulated
        )),
    )?;

    Ok(response)
}
