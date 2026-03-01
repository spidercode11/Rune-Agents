import { create } from "zustand";

// ─── Types ───

export type AgentState = "IDLE" | "WALKING" | "WORKING" | "RETURNING";

export interface Agent {
  id: string;
  name: string;
  role: string;
  sprite: string;
  tileX: number;
  tileY: number;
  homeTileX: number;
  homeTileY: number;
  state: AgentState;
}

export interface Building {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tileX: number;
  tileY: number;
  doorTileX: number;
  doorTileY: number;
  color: string;
  roofColor: string;
  command: string;
  args: string[];
  cwd: string;
}

export interface ChatMessage {
  id: string;
  type: "system" | "hint" | "action" | "command" | "output" | "success" | "error";
  text: string;
  timestamp: number;
}

export interface ActiveTask {
  buildingId: string;
  agentId: string;
  progress: number; // 0–1
  startedAt: number;
}

export interface Notification {
  id: string;
  text: string;
  buildingName: string;
  emoji: string;
  expiresAt: number;
}

// ─── Store ───

interface GameStore {
  // Agents
  agents: Agent[];
  updateAgent: (id: string, updates: Partial<Agent>) => void;

  // Buildings
  buildings: Building[];

  // Chat
  chatLog: ChatMessage[];
  addChat: (type: ChatMessage["type"], text: string) => void;
  clearChat: () => void;

  // Active task
  activeTask: ActiveTask | null;
  setActiveTask: (task: ActiveTask | null) => void;
  updateTaskProgress: (progress: number) => void;

  // Notifications
  notification: Notification | null;
  showNotification: (text: string, buildingName: string, emoji: string) => void;
  clearNotification: () => void;

  // Stats
  stats: { tasksCompleted: number; tokensUsed: number };
  incrementTasksCompleted: () => void;
  addTokensUsed: (amount: number) => void;
}

let chatIdCounter = 0;
let notifIdCounter = 0;

export const useGameStore = create<GameStore>((set) => ({
  // ─── Agents ───
  agents: [
    {
      id: "merlin",
      name: "Merlin",
      role: "Code Architect",
      sprite: "wizard",
      tileX: 6,
      tileY: 9,
      homeTileX: 6,
      homeTileY: 9,
      state: "IDLE",
    },
  ],
  updateAgent: (id, updates) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),

  // ─── Buildings ───
  buildings: [
    {
      id: "forge",
      name: "The Forge",
      emoji: "⚒️",
      description: "Compile & Refactor",
      tileX: 3,
      tileY: 4,
      doorTileX: 4,
      doorTileY: 6,
      color: "#8B4513",
      roofColor: "#CD853F",
      command: "echo",
      args: ["Forge task complete — refactored 3 files"],
      cwd: ".",
    },
    {
      id: "library",
      name: "The Library",
      emoji: "📚",
      description: "Documentation",
      tileX: 9,
      tileY: 4,
      doorTileX: 8,
      doorTileY: 6,
      color: "#4A4A6A",
      roofColor: "#7B7BA8",
      command: "echo",
      args: ["Library task complete — docs generated"],
      cwd: ".",
    },
    {
      id: "tower",
      name: "The Tower",
      emoji: "🔮",
      description: "Testing & QA",
      tileX: 3,
      tileY: 10,
      doorTileX: 4,
      doorTileY: 10,
      color: "#2F4F4F",
      roofColor: "#5F9EA0",
      command: "echo",
      args: ["Tower task complete — 17 tests passing"],
      cwd: ".",
    },
    {
      id: "tavern",
      name: "The Tavern",
      emoji: "🍺",
      description: "Deploy & Ship",
      tileX: 9,
      tileY: 10,
      doorTileX: 8,
      doorTileY: 10,
      color: "#722F37",
      roofColor: "#C4736E",
      command: "echo",
      args: ["Tavern task complete — deployed to production"],
      cwd: ".",
    },
  ],

  // ─── Chat ───
  chatLog: [
    { id: "init-1", type: "system", text: "RuneAgents v0.1 initialized", timestamp: Date.now() },
    { id: "init-2", type: "system", text: "Agent 'Merlin' spawned at home base", timestamp: Date.now() },
    { id: "init-3", type: "hint", text: "Click a building to assign a task →", timestamp: Date.now() },
  ],
  addChat: (type, text) =>
    set((s) => ({
      chatLog: [
        ...s.chatLog.slice(-100),
        { id: `chat-${++chatIdCounter}`, type, text, timestamp: Date.now() },
      ],
    })),
  clearChat: () => set({ chatLog: [] }),

  // ─── Active Task ───
  activeTask: null,
  setActiveTask: (task) => set({ activeTask: task }),
  updateTaskProgress: (progress) =>
    set((s) => (s.activeTask ? { activeTask: { ...s.activeTask, progress } } : {})),

  // ─── Notifications ───
  notification: null,
  showNotification: (text, buildingName, emoji) =>
    set({
      notification: {
        id: `notif-${++notifIdCounter}`,
        text,
        buildingName,
        emoji,
        expiresAt: Date.now() + 4000,
      },
    }),
  clearNotification: () => set({ notification: null }),

  // ─── Stats ───
  stats: { tasksCompleted: 0, tokensUsed: 0 },
  incrementTasksCompleted: () =>
    set((s) => ({ stats: { ...s.stats, tasksCompleted: s.stats.tasksCompleted + 1 } })),
  addTokensUsed: (amount) =>
    set((s) => ({ stats: { ...s.stats, tokensUsed: s.stats.tokensUsed + amount } })),
}));
