use tauri::State;

use crate::commands::authz::require_permission;
use crate::domain::audit::{AuditAction, AuditActor, AuditLogEntry};
use crate::domain::llm::{
    LlmInvocationRequest, LlmInvocationResponse, LlmProviderConfig,
};
use crate::domain::permission::Permission;
use crate::errors::AppError;
use crate::state::AppState;

fn audit(state: &AppState, action: AuditAction, details: Option<String>) {
    let entry = AuditLogEntry::new(
        action,
        AuditActor::User {
            name: "desktop".to_string(),
        },
        details,
    );
    let _ = state.audit_store.append(&entry);
}

#[tauri::command]
pub fn cmd_configure_llm_provider(
    state: State<'_, AppState>,
    config: LlmProviderConfig,
) -> Result<LlmProviderConfig, AppError> {
    require_permission(&state, Permission::ConfigureLlmProvider, "configure_llm_provider")?;

    let configured = state.llm_gateway.configure_provider(config)?;

    audit(
        &state,
        AuditAction::LlmProviderConfigured,
        Some(format!(
            "provider={}, model={}, enabled={}",
            configured.provider.display_name(),
            configured.model,
            configured.enabled
        )),
    );

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

    audit(
        &state,
        AuditAction::LlmInvoked,
        Some(format!(
            "provider={}, model={}, simulated={}",
            provider_name,
            response.model,
            response.simulated
        )),
    );

    Ok(response)
}
