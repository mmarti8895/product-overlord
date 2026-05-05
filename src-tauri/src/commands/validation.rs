use crate::errors::AppError;
use crate::validation::{
    validate_cron, validate_jql, validate_base_url,
    CronExpression, JqlValidationResult, UrlValidationResult,
};

/// Validate a JQL string and return a normalised result.
/// Called by the frontend before persisting a notification rule filter.
#[tauri::command]
pub fn cmd_validate_jql(raw: String) -> Result<JqlValidationResult, AppError> {
    validate_jql(&raw)
}

/// Validate a 5-field cron expression.
/// Called by the frontend before persisting a scan schedule.
#[tauri::command]
pub fn cmd_validate_cron(raw: String) -> Result<CronExpression, AppError> {
    validate_cron(&raw)
}

/// Validate a base URL intended for use as an integration endpoint.
/// Called by the frontend when the user enters a custom Jira/Ollama URL.
#[tauri::command]
pub fn cmd_validate_base_url(raw: String) -> Result<UrlValidationResult, AppError> {
    validate_base_url(&raw)
}
