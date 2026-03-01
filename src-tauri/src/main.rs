// RuneAgents — Tauri Backend
//
// This is the Rust side of the application. It handles:
// 1. Spawning CLI processes (claude code, npm, etc.)
// 2. Streaming stdout/stderr back to the frontend
// 3. Reading/writing the local file system
// 4. Managing agent configuration

mod commands;
mod process_manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::execute_task,
            commands::read_config_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running RuneAgents");
}
