# 🏰 RuneAgents

A gamified desktop app that visualizes AI coding agents as characters in an old-school RuneScape-style isometric village. Instead of typing in a terminal, manage your AI agents by sending them to buildings that execute real CLI commands against your local projects.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Tauri 2.0 (Rust) |
| UI Framework | React 18 + TypeScript |
| Game Renderer | PixiJS 8 |
| State Management | Zustand |
| Process Execution | Tauri Command API (Rust → shell) |
| Styling | Tailwind CSS |
| Config | TOML + SQLite |

## Project Structure

```
rune-agents/
├── src/
│   ├── game/                    # PixiJS game engine
│   │   ├── GameCanvas.tsx       # PixiJS mount + game loop
│   │   ├── entities/            # Agents, buildings, NPCs
│   │   ├── map/                 # Isometric grid, tiles, pathfinding
│   │   ├── systems/             # Particles, animations, camera
│   │   └── assets/              # Sprites, tilesets, fonts
│   ├── ui/                      # React HUD overlay
│   │   ├── panels/              # TopBar, ChatPanel, MissionPanel, etc.
│   │   ├── components/          # Shared UI pieces
│   │   └── styles/              # Tailwind + OSRS theme tokens
│   ├── store/                   # Zustand state management
│   ├── bridge/                  # Frontend ↔ Tauri IPC
│   └── config/                  # Agent & building definitions
├── src-tauri/                   # Rust backend
│   └── src/
│       ├── main.rs              # Tauri app entry
│       ├── commands.rs          # IPC command handlers
│       └── process_manager.rs   # Shell execution + streaming
├── docs/                        # Design specs & Figma exports
└── agents.toml                  # Runtime configuration
```

## Getting Started

```bash
# Prerequisites: Rust, Node.js 20+
npm install
cargo tauri dev
```

## Build Phases

See the [full build plan on Notion](https://www.notion.so/31617742e5a481a18c3bedb238a471f2) for step-by-step instructions.

## License

MIT
