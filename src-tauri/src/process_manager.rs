use std::path::Path;
use std::process::Stdio;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::commands::TaskResult;

/// Spawn a child process and stream its stdout/stderr to the frontend.
///
/// Each line of output is emitted as a "task-output" event that the
/// frontend's ChatPanel listens to and displays in real-time.
pub async fn run_command(
    app: tauri::AppHandle,
    command: &str,
    args: &[String],
    cwd: &Path,
) -> Result<TaskResult, String> {
    let mut child = Command::new(command)
        .args(args)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn '{}': {}", command, e))?;

    // Stream stdout
    if let Some(stdout) = child.stdout.take() {
        let app_clone = app.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_clone.emit("task-output", &line);
            }
        });
    }

    // Stream stderr
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = app_clone.emit("task-error", &line);
            }
        });
    }

    // Wait for the process to complete
    let status = child.wait().await.map_err(|e| format!("Process error: {}", e))?;

    Ok(TaskResult {
        success: status.success(),
        exit_code: status.code().unwrap_or(-1),
    })
}
