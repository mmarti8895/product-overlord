pub mod commands;
pub mod domain;
pub mod errors;
pub mod state;
pub mod storage;

use commands::credential::{
    cmd_add_credential, cmd_check_credential_health, cmd_delete_credential, cmd_list_credentials,
};
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
