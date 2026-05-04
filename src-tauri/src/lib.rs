pub mod commands;
pub mod domain;
pub mod errors;
pub mod llm;
pub mod security;
pub mod session;
pub mod state;
pub mod storage;
pub mod sync_utils;
pub mod validation;

use commands::credential::{
    cmd_add_credential, cmd_check_credential_health, cmd_delete_credential, cmd_list_credentials,
};
use commands::audit::cmd_verify_audit_integrity;
use commands::index::{
    cmd_check_index_store_health, cmd_get_index_store_health, cmd_initialize_index_store,
};
use commands::llm::{cmd_configure_llm_provider, cmd_invoke_llm, cmd_list_llm_provider_configs};
use commands::permission::{cmd_get_current_role, cmd_set_current_role};
use commands::session::{cmd_get_session_status, cmd_lock_session, cmd_unlock_session};
use commands::scaffolding::{
    cmd_create_ticket_scaffold, cmd_get_ticket_scaffold, cmd_list_ticket_scaffolds,
    cmd_set_acceptance_criteria, cmd_set_dor_item_status, cmd_set_effort_estimate,
};
use commands::validation::{cmd_validate_base_url, cmd_validate_cron, cmd_validate_jql};
use state::AppState;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            cmd_add_credential,
            cmd_delete_credential,
            cmd_check_credential_health,
            cmd_list_credentials,
            cmd_initialize_index_store,
            cmd_get_index_store_health,
            cmd_check_index_store_health,
            cmd_get_current_role,
            cmd_set_current_role,
            cmd_unlock_session,
            cmd_lock_session,
            cmd_get_session_status,
            cmd_configure_llm_provider,
            cmd_list_llm_provider_configs,
            cmd_invoke_llm,
            cmd_create_ticket_scaffold,
            cmd_get_ticket_scaffold,
            cmd_list_ticket_scaffolds,
            cmd_set_dor_item_status,
            cmd_set_acceptance_criteria,
            cmd_set_effort_estimate,
            cmd_validate_jql,
            cmd_validate_cron,
            cmd_validate_base_url,
            cmd_verify_audit_integrity,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
