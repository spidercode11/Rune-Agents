use serde::Serialize;
use std::path::PathBuf;

use crate::process_manager;

/// Result returned to the frontend after a task completes.
#[derive(Serialize)]
pub struct TaskResult {
    pub success: bool,
    pub exit_code: i32,
}

/// Execute a shell command and stream output back to the frontend.
///
/// Called from the frontend via: invoke("execute_task", { command, args, cwd })
///
/// The command's stdout is streamed line-by-line to the frontend via
/// Tauri events ("task-output"), so the chat panel can display real-time output.
#[tauri::command]
pub async fn execute_task(
    app: tauri::AppHandle,
    command: String,
    args: Vec<String>,
    cwd: String,
) -> Result<TaskResult, String> {
    let cwd_path = PathBuf::from(&cwd);

    if !cwd_path.exists() {
        return Err(format!("Working directory does not exist: {}", cwd));
    }

    process_manager::run_command(app, &command, &args, &cwd_path).await
}

/// Read the agents.toml configuration file.
///
/// Looks for the file in the app's config directory or the current working directory.
#[tauri::command]
pub async fn read_config_file(path: String) -> Result<String, String> {
    let config_path = PathBuf::from(&path);

    if !config_path.exists() {
        return Err(format!("Config file not found: {}", path));
    }

    std::fs::read_to_string(&config_path).map_err(|e| format!("Failed to read config: {}", e))
}
