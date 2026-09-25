import { Container } from 'pixi.js'
import {
  Agent,
  WIZARD_VISUALS,
  RANGER_VISUALS,
  KNIGHT_VISUALS,
  ALCHEMIST_VISUALS,
  CLERIC_VISUALS,
} from './Agent'
import { findPath } from './Pathfinder'
import { GRID_SIZE } from './IsometricMap'
import { SKILLS_BY_CHARACTER } from '../data/agentSkills'
import type { AgentRecord } from '../store/gameStore'

export const AGENT_IDS = ['merlin', 'robin', 'rex', 'lyra', 'sera'] as const
export type AgentId = (typeof AGENT_IDS)[number]

interface AgentDef {
  id:       AgentId
  name:     string
  tileX:    number
  tileY:    number
  visuals:  typeof WIZARD_VISUALS
  nudgeIdx: number
}

const AGENT_DEFS: AgentDef[] = [
  { id: 'merlin', name: 'Merlin', tileX: 17, tileY: 20, visuals: WIZARD_VISUALS,    nudgeIdx: 0 },
  { id: 'robin',  name: 'Robin',  tileX: 19, tileY: 20, visuals: RANGER_VISUALS,    nudgeIdx: 1 },
  { id: 'rex',    name: 'Rex',    tileX: 15, tileY: 20, visuals: KNIGHT_VISUALS,    nudgeIdx: 2 },
  { id: 'lyra',   name: 'Lyra',   tileX: 19, tileY: 22, visuals: ALCHEMIST_VISUALS, nudgeIdx: 3 },
  { id: 'sera',   name: 'Sera',   tileX: 15, tileY: 22, visuals: CLERIC_VISUALS,    nudgeIdx: 4 },
]

export class AgentManager {
  private readonly agents: Agent[] = []
  private selectedIndex = 0
  private onAgentSelected?: (agentId: AgentId) => void

  get all(): Agent[] { return this.agents }
  get selected(): Agent { return this.agents[this.selectedIndex] }
  get selectedId(): AgentId { return AGENT_DEFS[this.selectedIndex].id }
  get selectedIsIdle(): boolean { return this.selected.isIdle }

  setOnAgentSelected(cb: (agentId: AgentId) => void): void {
    this.onAgentSelected = cb
  }

  init(offsetX: number, offsetY: number, agentLayer: Container): void {
    for (let i = 0; i < AGENT_DEFS.length; i++) {
      const def   = AGENT_DEFS[i]
      const agent = new Agent(def.tileX, def.tileY, def.name, def.visuals, def.nudgeIdx)
      agent.init(offsetX, offsetY)
      agentLayer.addChild(agent.container)
      this.agents.push(agent)
    }
    this.agents[0].select()
  }

  update(): void {
    for (const agent of this.agents) {
      const avoid = new Set<number>()
      for (const other of this.agents) {
        if (other === agent) continue
        avoid.add(other.tileY * GRID_SIZE + other.tileX)
      }
      agent.setWanderAvoid(avoid)
      agent.update()
    }
  }

  toRecords(): AgentRecord[] {
    return this.agents.map((agent, i) => {
      const type = agent.characterType
      return {
        id:            AGENT_DEFS[i].id,
        name:          agent.name,
        characterType: type,
        state:         agent.agentState,
        skills:        SKILLS_BY_CHARACTER[type],
        rosterColor:   `#${agent.rosterColor.toString(16).padStart(6, '0')}`,
      }
    })
  }

  indexOfId(agentId: string): number {
    return AGENT_DEFS.findIndex((d) => d.id === agentId)
  }

  trySelectAt(localX: number, localY: number): boolean {
    const HIT_RADIUS = 28
    for (let i = 0; i < this.agents.length; i++) {
      const a  = this.agents[i]
      const dx = localX - a.container.x
      const dy = localY - a.container.y
      if (Math.hypot(dx, dy) <= HIT_RADIUS) {
        if (!a.isIdle) {
          this.setSelected(i)
          return true
        }
        this.setSelected(i)
        return true
      }
    }
    return false
  }

  selectById(agentId: string): boolean {
    const i = this.indexOfId(agentId)
    if (i < 0) return false
    this.setSelected(i)
    return true
  }

  dispatchForAgent(
    agentId: string,
    goalTx: number,
    goalTy: number,
    doorTiles: [number, number][],
  ): [number, number][] | null {
    const i = this.indexOfId(agentId)
    if (i < 0) return null
    if (i !== this.selectedIndex) this.setSelected(i)
    return this.dispatchSelected(goalTx, goalTy, doorTiles)
  }

  dispatchSelected(
    goalTx: number,
    goalTy: number,
    doorTiles: [number, number][],
  ): [number, number][] | null {
    const agent = this.selected
    if (!agent.isIdle) return null

    const soft = new Set<number>()
    for (const other of this.agents) {
      if (other === agent) continue
      soft.add(other.tileY * GRID_SIZE + other.tileX)
    }

    const path = findPath(agent.tileX, agent.tileY, goalTx, goalTy, doorTiles, soft)
    if (path && path.length > 0) {
      agent.dispatch(path, goalTx, goalTy)
    }
    return path
  }

  private setSelected(index: number): void {
    if (index === this.selectedIndex) {
      this.onAgentSelected?.(AGENT_DEFS[index].id)
      return
    }
    this.agents[this.selectedIndex].deselect()
    this.selectedIndex = index
    this.agents[this.selectedIndex].select()
    this.onAgentSelected?.(AGENT_DEFS[index].id)
  }
}
