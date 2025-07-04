// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            
            // Devtools can be opened manually if needed via right-click -> Inspect
            // or by pressing Cmd+Option+I on macOS
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
