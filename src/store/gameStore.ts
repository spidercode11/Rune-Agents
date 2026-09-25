import { create } from 'zustand'
import type { AgentState, CharacterType } from '../game/Agent'

export interface AgentRecord {
  id: string
  name: string
  characterType: CharacterType
  state: AgentState
  skills: string[]
  rosterColor: string
}

export interface DispatchTarget {
  id: string
  name: string
  kind: 'project' | 'building'
}

interface GameState {
  agents: AgentRecord[]
  dispatchTargets: DispatchTarget[]
  selectedAgentId: string | null
  characterHudOpen: boolean
  sendToExpanded: boolean
  promptOpen: boolean
  pendingTaskLabel: string
  pendingPrompt: string
  pendingTargetId: string | null

  syncAgents: (agents: AgentRecord[]) => void
  syncDispatchTargets: (targets: DispatchTarget[]) => void
  openCharacterHud: (agentId: string) => void
  closeCharacterHud: () => void
  toggleSendTo: () => void
  openPrompt: (taskLabel: string, defaultPrompt: string) => void
  closePrompt: () => void
  setPendingPrompt: (text: string) => void
  setPendingTarget: (targetId: string | null) => void
}

export const useGameStore = create<GameState>((set) => ({
  agents: [],
  dispatchTargets: [],
  selectedAgentId: null,
  characterHudOpen: false,
  sendToExpanded: false,
  promptOpen: false,
  pendingTaskLabel: '',
  pendingPrompt: '',
  pendingTargetId: null,

  syncAgents: (agents) => set({ agents }),

  syncDispatchTargets: (targets) => set({ dispatchTargets: targets }),

  openCharacterHud: (agentId) =>
    set({
      selectedAgentId: agentId,
      characterHudOpen: true,
      sendToExpanded: false,
      promptOpen: false,
    }),

  closeCharacterHud: () =>
    set({
      characterHudOpen: false,
      sendToExpanded: false,
      promptOpen: false,
      pendingTargetId: null,
    }),

  toggleSendTo: () => set((s) => ({ sendToExpanded: !s.sendToExpanded })),

  openPrompt: (taskLabel, defaultPrompt) =>
    set({
      promptOpen: true,
      pendingTaskLabel: taskLabel,
      pendingPrompt: defaultPrompt,
    }),

  closePrompt: () => set({ promptOpen: false }),

  setPendingPrompt: (text) => set({ pendingPrompt: text }),

  setPendingTarget: (targetId) => set({ pendingTargetId: targetId }),
}))

export function selectedAgent(state: GameState): AgentRecord | undefined {
  return state.agents.find((a) => a.id === state.selectedAgentId)
}
