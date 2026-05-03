// product-overlord — Tauri 2 sidecar host
// Tasks 6.3, 6.4, 3.5

use std::net::TcpListener;
use std::sync::Mutex;
use tauri::{
    AppHandle, Manager, Runtime,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

use tauri_plugin_shell::ShellExt;

/// Global sidecar child handle so we can SIGTERM on exit.
static SIDECAR: Mutex<Option<tauri_plugin_shell::process::CommandChild>> = Mutex::new(None);

/// Find a free TCP port starting at `start` (Task 6.4).
fn find_free_port(start: u16) -> u16 {
    let mut port = start;
    loop {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return port;
        }
        port += 1;
    }
}

/// Tauri command: return the port the sidecar is listening on.
#[tauri::command]
fn get_server_port() -> u16 {
    std::env::var("OVERLORD_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3000)
}

fn spawn_sidecar(app: &AppHandle) {
    let port = find_free_port(3000);
    // Persist so the webview Vite proxy and `get_server_port` can read it.
    std::env::set_var("OVERLORD_PORT", port.to_string());

    let sidecar_cmd = app
        .shell()
        .sidecar("product-overlord-server")
        .expect("sidecar binary not configured — run 'npm run build:server' first");

    let (_rx, child) = sidecar_cmd
        .env("PORT", port.to_string())
        .env("BASE_URL", format!("http://localhost:{port}"))
        .spawn()
        .expect("failed to spawn product-overlord-server sidecar");

    *SIDECAR.lock().unwrap() = Some(child);
}

fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "hide" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            "quit" => {
                if let Some(mut child) = SIDECAR.lock().unwrap().take() {
                    let _ = child.kill();
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_stronghold::Builder::new(|password| {
                use std::hash::{Hash, Hasher};
                let mut hasher = std::collections::hash_map::DefaultHasher::new();
                password.hash(&mut hasher);
                hasher.finish().to_le_bytes().to_vec()
            })
            .build(),
        )
        .setup(|app| {
            spawn_sidecar(app.handle());
            setup_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|_window, event| {
            // SIGTERM sidecar when the last window is destroyed (Task 6.3)
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(mut child) = SIDECAR.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![get_server_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
