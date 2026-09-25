import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { Agent, AgentState } from './Agent'

// Status dot colour per state
const STATE_DOT: Record<AgentState, number> = {
  IDLE:      0x44DD44,   // green
  WALKING:   0xFFDD00,   // yellow
  AT_DOOR:   0xFFAA00,   // amber
  WORKING:   0xFF4444,   // red
  RETURNING: 0x44AAFF,   // blue
}

const PANEL_W   = 130
const ROW_H     = 26
const PAD       = 8
const ICON_R    = 7
const DOT_R     = 4

/**
 * A small fixed-position PixiJS panel that shows all agents with a coloured
 * icon, name, and a status dot.  Add its `container` directly to `app.stage`
 * (not to the isometric map container) so it stays fixed during pan / zoom.
 */
export class AgentRoster {
  readonly container = new Container()
  private agents: Agent[] = []

  attach(agents: Agent[]): void {
    this.agents = agents
  }

  /** Call every frame — cheaply redraws the panel to reflect current state. */
  update(selectedAgent: Agent): void {
    this.container.removeChildren()

    const panelH = PAD * 2 + ROW_H * this.agents.length
    const bg = new Graphics()
    bg.roundRect(0, 0, PANEL_W, panelH, 6)
    bg.fill({ color: 0x0A0A18, alpha: 0.78 })
    bg.stroke({ color: 0x444466, width: 1 })
    this.container.addChild(bg)

    // Title
    const titleStyle = new TextStyle({
      fontFamily: 'monospace',
      fontSize:   9,
      fill:       0x8888CC,
      fontWeight: 'bold',
      letterSpacing: 1,
    })
    const title = new Text({ text: 'AGENTS', style: titleStyle })
    title.x = PAD
    title.y = PAD - 2
    this.container.addChild(title)

    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i]
      const rowY  = PAD + 12 + i * ROW_H
      const isSelected = agent === selectedAgent

      // Highlight row for selected agent
      if (isSelected) {
        const hl = new Graphics()
        hl.roundRect(3, rowY - 3, PANEL_W - 6, ROW_H - 2, 4)
        hl.fill({ color: 0xFFD700, alpha: 0.12 })
        hl.stroke({ color: 0xFFD700, alpha: 0.45, width: 1 })
        this.container.addChild(hl)
      }

      // Agent colour icon
      const icon = new Graphics()
      icon.circle(PAD + ICON_R, rowY + ROW_H / 2 - 4, ICON_R)
      icon.fill(agent.rosterColor)
      if (isSelected) {
        icon.circle(PAD + ICON_R, rowY + ROW_H / 2 - 4, ICON_R)
        icon.stroke({ color: 0xFFD700, width: 1.5 })
      }
      this.container.addChild(icon)

      // Agent name
      const nameStyle = new TextStyle({
        fontFamily: 'monospace',
        fontSize:   10,
        fill:       isSelected ? 0xFFD700 : 0xCCCCCC,
        fontWeight: isSelected ? 'bold' : 'normal',
      })
      const nameLabel = new Text({ text: agent.name, style: nameStyle })
      nameLabel.x = PAD + ICON_R * 2 + 4
      nameLabel.y = rowY + ROW_H / 2 - 9
      this.container.addChild(nameLabel)

      // Status dot
      const dotColor = STATE_DOT[agent.agentState]
      const dot = new Graphics()
      dot.circle(PANEL_W - PAD - DOT_R, rowY + ROW_H / 2 - 4, DOT_R)
      dot.fill(dotColor)
      // Subtle glow ring
      dot.circle(PANEL_W - PAD - DOT_R, rowY + ROW_H / 2 - 4, DOT_R + 2)
      dot.stroke({ color: dotColor, alpha: 0.4, width: 1.5 })
      this.container.addChild(dot)

      // State label (tiny, below name)
      const stateStyle = new TextStyle({
        fontFamily: 'monospace',
        fontSize:   8,
        fill:       0x888888,
      })
      const stateLabel = new Text({ text: agent.agentState, style: stateStyle })
      stateLabel.x = PAD + ICON_R * 2 + 4
      stateLabel.y = rowY + ROW_H / 2 + 1
      this.container.addChild(stateLabel)
    }
  }
}
