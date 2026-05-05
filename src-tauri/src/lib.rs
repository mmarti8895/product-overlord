pub mod commands;
pub mod domain;
pub mod errors;
pub mod llm;
pub mod security;
pub mod security_tests;
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
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Update the system-tray tooltip and icon to reflect overall integration health.
/// Called from the frontend after each credential health poll.
/// status: "ok" | "degraded" | "error"
#[tauri::command]
fn cmd_set_tray_status(app: tauri::AppHandle, status: String) -> Result<(), String> {
    let tooltip = match status.as_str() {
        "degraded" => "Product Overlord \u{2014} \u{26a0} Some connections degraded",
        "error"    => "Product Overlord \u{2014} \u{2717} Connections unavailable",
        _          => "Product Overlord \u{2014} All connections healthy",
    };

    let icon = match status.as_str() {
        "degraded" | "error" => tauri::include_image!("icons/tray-degraded.png"),
        _                    => tauri::include_image!("icons/tray-normal.png"),
    };

    if let Some(tray) = app.tray_by_id("main_tray") {
        tray.set_tooltip(Some(tooltip)).map_err(|e| e.to_string())?;
        tray.set_icon(Some(icon)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            cmd_set_tray_status,
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
        .setup(|app| {
            // ── System tray ──────────────────────────────────────────────────
            let hub_open   = MenuItem::with_id(app, "hub_open",   "Open Integration Hub", true, None::<&str>)?;
            let hub_llm    = MenuItem::with_id(app, "hub_llm",    "  LLM Connections",    true, None::<&str>)?;
            let hub_jira   = MenuItem::with_id(app, "hub_jira",   "  Jira MCP",           true, None::<&str>)?;
            let hub_github = MenuItem::with_id(app, "hub_github", "  GitHub Repositories",true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let show_hide = MenuItem::with_id(app, "show_hide", "Show / Hide", true, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[
                &hub_open, &hub_llm, &hub_jira, &hub_github,
                &sep1, &show_hide, &sep2, &quit,
            ])?;

            TrayIconBuilder::with_id("main_tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    let show_window = |app: &tauri::AppHandle| {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    };
                    match event.id.as_ref() {
                        "hub_open" => {
                            show_window(app);
                            let _ = app.emit("hub://open", "llm");
                        }
                        "hub_llm" => {
                            show_window(app);
                            let _ = app.emit("hub://open", "llm");
                        }
                        "hub_jira" => {
                            show_window(app);
                            let _ = app.emit("hub://open", "jira");
                        }
                        "hub_github" => {
                            show_window(app);
                            let _ = app.emit("hub://open", "github");
                        }
                        "show_hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ── Hide window on close instead of quitting ─────────────────────
            if let Some(window) = app.get_webview_window("main") {
                let win = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win.hide();
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
