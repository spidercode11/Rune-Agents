/**
 * Bridge layer between the React/PixiJS frontend and the Tauri Rust backend.
 *
 * In Phase 1, task execution is simulated in the frontend.
 * In Phase 8, these functions will call real Tauri `invoke()` commands
 * that spawn CLI processes on the local machine.
 *
 * Usage:
 *   import { executeTask, onTaskOutput } from "@/bridge/tauriCommands";
 *   const result = await executeTask("echo", ["hello"], "/home/user/project");
 */

// ─── Types ───

export interface TaskResult {
  success: boolean;
  exitCode: number;
}

// ─── Commands (Phase 8: replace with real Tauri invoke calls) ───

/**
 * Execute a shell command via the Tauri backend.
 *
 * Phase 1 (current): Returns a simulated result after a delay.
 * Phase 8 (future):  Calls `invoke("execute_task", { command, args, cwd })`
 */
export async function executeTask(
  command: string,
  args: string[],
  cwd: string
): Promise<TaskResult> {
  // TODO Phase 8: Replace with real Tauri invocation
  //
  // import { invoke } from "@tauri-apps/api/core";
  // return await invoke<TaskResult>("execute_task", { command, args, cwd });

  console.log(`[Bridge] executeTask: ${command} ${args.join(" ")} in ${cwd}`);

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, exitCode: 0 });
    }, 3000);
  });
}

/**
 * Listen for streaming task output from the Rust backend.
 *
 * Phase 1: Not implemented (output is simulated in GameCanvas).
 * Phase 8: Listens for Tauri "task-output" events.
 */
export function onTaskOutput(callback: (line: string) => void): () => void {
  // TODO Phase 8: Replace with real Tauri event listener
  //
  // import { listen } from "@tauri-apps/api/event";
  // const unlisten = listen<string>("task-output", (event) => callback(event.payload));
  // return () => { unlisten.then((fn) => fn()); };

  console.log("[Bridge] onTaskOutput: listener registered (simulated)");
  return () => {};
}

/**
 * Read the agents.toml config file from disk.
 *
 * Phase 1: Returns null (config is hardcoded in the store).
 * Phase 9: Reads via Tauri FS plugin.
 */
export async function readConfig(): Promise<string | null> {
  // TODO Phase 9: Replace with real Tauri FS read
  //
  // import { readTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
  // return await readTextFile("agents.toml", { baseDir: BaseDirectory.AppConfig });

  console.log("[Bridge] readConfig: not yet implemented");
  return null;
}
