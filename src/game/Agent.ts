import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import { toScreen, TILE_H, GRID, GRID_SIZE } from './IsometricMap'
import { findPath } from './Pathfinder'

export type AgentState = 'IDLE' | 'WALKING' | 'AT_DOOR' | 'WORKING' | 'RETURNING'
export type CharacterType = 'wizard' | 'ranger' | 'knight' | 'alchemist' | 'cleric'

const MOVE_DURATION        = 300
const WANDER_MOVE_DURATION = 780
const AT_DOOR_DURATION     = 1000
const WORK_DURATION        = 3000
const WANDER_PAUSE_MIN     = 1200
const WANDER_PAUSE_MAX     = 3800
const WANDER_DELAY_MIN     =  600
const WANDER_DELAY_MAX     = 2000
const WANDER_RANGE         =    8
const WANDER_RANGE_MIN     =    3
const WANDER_SPREAD_MIN    =    3

export interface AgentVisualConfig {
  type:        CharacterType
  color1:      number   // primary body/robe color
  color2:      number   // secondary highlight/accent color
  color3:      number   // glow / orb / gem color
  color4:      number   // dark trim / outlines
  rosterColor: number   // colour used in the roster panel
}

// ── Preset visual configs ──────────────────────────────────────────────────────

export const WIZARD_VISUALS: AgentVisualConfig = {
  type:        'wizard',
  color1:      0x3B1F6E,  // deep purple robe
  color2:      0x5A3A9E,  // purple highlight
  color3:      0x44EEBB,  // cyan orb glow
  color4:      0x2D1755,  // very dark purple
  rosterColor: 0x9B6DD6,
}

export const RANGER_VISUALS: AgentVisualConfig = {
  type:        'ranger',
  color1:      0x2D5A27,  // forest green cloak
  color2:      0x1A3D0D,  // dark green hood
  color3:      0x8FD157,  // bright green accent
  color4:      0x5C3317,  // dark wood brown
  rosterColor: 0x5A9E3A,
}

export const KNIGHT_VISUALS: AgentVisualConfig = {
  type:        'knight',
  color1:      0x8A8A8A,  // silver armor
  color2:      0xBBBBBB,  // light silver highlight
  color3:      0x8B1A1A,  // deep red
  color4:      0xD4A017,  // gold trim
  rosterColor: 0xE25050,
}

export const ALCHEMIST_VISUALS: AgentVisualConfig = {
  type:        'alchemist',
  color1:      0x4B1F6E,  // dark purple robe
  color2:      0x6B3A8E,  // medium purple
  color3:      0x44EE44,  // bright green flask glow
  color4:      0x2A0F3D,  // very dark purple
  rosterColor: 0x44BB44,
}

export const CLERIC_VISUALS: AgentVisualConfig = {
  type:        'cleric',
  color1:      0xF0EDD0,  // cream robes
  color2:      0xDDD8B0,  // slightly darker cream
  color3:      0xFFE87C,  // warm golden glow
  color4:      0xFFD700,  // bright gold
  rosterColor: 0xF5D76E,
}

export class Agent {
  readonly container = new Container()

  private character      = new Container()
  private selectionRing!: Graphics
  private statusIcon!:    Text

  tileX: number
  tileY: number
  private readonly homeTileX: number
  private readonly homeTileY: number
  private offsetX = 0
  private offsetY = 0

  /**
   * Continuous tile-row position used for depth sorting against buildings.
   * Buildings sort by the tile row of their footprint's south edge — using
   * the same row-based basis here (instead of raw screen Y, which conflates
   * a tile's X and Y) keeps agents correctly in front of/behind buildings
   * whose door isn't at the extreme SE corner of their footprint.
   */
  depthRow = 0

  private readonly nudgeX: number
  private readonly nudgeY: number

  private state: AgentState = 'IDLE'

  private path: [number, number][] = []
  private pathIndex = 0
  private fromX = 0
  private fromY = 0
  private toX   = 0
  private toY   = 0
  private moveStartTime = 0

  private stateStartTime = 0

  private doorTileX = 0
  private doorTileY = 0

  private wanderActive    = false
  private wanderPath:  [number, number][] = []
  private wanderIdx       = 0
  private wanderFromX     = 0
  private wanderFromY     = 0
  private wanderToX       = 0
  private wanderToY       = 0
  private wanderMoveStart = 0
  private wanderNextAt    = 0
  private wanderAvoidKeys: Set<number> = new Set()

  constructor(
    tileX: number,
    tileY: number,
    readonly name: string,
    private readonly visuals: AgentVisualConfig,
    nudgeIndex: number = 0,
  ) {
    this.tileX = tileX
    this.tileY = tileY
    this.homeTileX = tileX
    this.homeTileY = tileY
    const nudges: [number, number][] = [[0, 0], [-9, -3], [9, -3], [-12, 4], [12, 4]]
    const n = nudges[nudgeIndex % nudges.length]
    this.nudgeX = n[0]
    this.nudgeY = n[1]
  }

  get isIdle(): boolean { return this.state === 'IDLE' }
  get agentState(): AgentState { return this.state }
  get characterType(): CharacterType { return this.visuals.type }
  get rosterColor(): number { return this.visuals.rosterColor }

  setWanderAvoid(keys: Set<number>): void { this.wanderAvoidKeys = keys }

  init(offsetX: number, offsetY: number): void {
    this.offsetX = offsetX
    this.offsetY = offsetY
    const pos = this.screenPos(this.tileX, this.tileY)
    this.container.x = pos.x
    this.container.y = pos.y
    this.depthRow = this.tileY
    this.buildSelectionRing()
    this.buildShadow()
    this.buildCharacter()
    this.container.addChild(this.character)
    this.wanderNextAt = Date.now() + WANDER_DELAY_MIN + Math.random() * WANDER_DELAY_MAX
  }

  select(): void   { this.selectionRing.visible = true }
  deselect(): void { this.selectionRing.visible = false }

  dispatch(
    path: [number, number][],
    doorTileX: number,
    doorTileY: number,
  ): void {
    if (this.state !== 'IDLE' || path.length === 0) return
    this.wanderActive      = false
    this.character.rotation = 0
    this.character.y        = 0
    this.path      = path
    this.pathIndex = 0
    this.doorTileX = doorTileX
    this.doorTileY = doorTileY
    this.state     = 'WALKING'
    this.setStatusIcon()
    this.beginNextStep()
  }

  update(): void {
    const now = Date.now()
    switch (this.state) {
      case 'IDLE':
        this.tickIdleWander(now)
        break
      case 'WALKING':
      case 'RETURNING':
        this.tickWalking(now)
        break
      case 'AT_DOOR':
        this.tickAtDoor(now)
        break
      case 'WORKING':
        this.tickWorking(now)
        break
    }
  }

  // ── State ticks ───────────────────────────────────────────────────────────

  private tickWalking(now: number): void {
    const t = Math.min((now - this.moveStartTime) / MOVE_DURATION, 1)
    this.container.x = this.fromX + (this.toX - this.fromX) * t
    this.container.y = this.fromY + (this.toY - this.fromY) * t

    const [, destTy] = this.path[this.pathIndex]
    this.depthRow = this.tileY + (destTy - this.tileY) * t

    this.character.rotation = Math.sin(now / 120) * 0.2
    this.character.y        = 0

    if (t >= 1) {
      this.container.x = this.toX
      this.container.y = this.toY

      const [ntx, nty]        = this.path[this.pathIndex]
      this.tileX              = ntx
      this.tileY              = nty
      this.depthRow            = nty
      this.character.rotation = 0
      this.pathIndex++

      if (this.pathIndex < this.path.length) {
        this.beginNextStep()
      } else if (this.state === 'WALKING') {
        this.state          = 'AT_DOOR'
        this.stateStartTime = now
        this.setStatusIcon()
      } else {
        this.tileX = this.homeTileX
        this.tileY = this.homeTileY
        this.depthRow = this.homeTileY
        this.character.alpha = 1
        this.character.scale.set(1)
        this.state = 'IDLE'
        this.wanderNextAt = now + WANDER_DELAY_MIN + Math.random() * WANDER_DELAY_MAX
        this.setStatusIcon()
      }
    }
  }

  private tickAtDoor(now: number): void {
    this.character.y = Math.sin(now / 800) * 2
    if (now - this.stateStartTime >= AT_DOOR_DURATION) {
      this.state          = 'WORKING'
      this.stateStartTime = now
      this.setStatusIcon()
    }
  }

  private tickWorking(now: number): void {
    const elapsed = now - this.stateStartTime
    const fadeT = Math.min(elapsed / 500, 1)
    this.character.alpha = 1 - fadeT
    this.character.scale.set(1 - fadeT * 0.7)
    this.character.y = 0

    if (elapsed >= WORK_DURATION) {
      this.character.alpha = 1
      this.character.scale.set(1)
      this.returnHome()
    }
  }

  // ── Movement helpers ──────────────────────────────────────────────────────

  private screenPos(tx: number, ty: number): { x: number; y: number } {
    const { x, y } = toScreen(tx, ty, this.offsetX, this.offsetY)
    return { x: x + this.nudgeX, y: y + TILE_H / 2 + this.nudgeY }
  }

  private beginNextStep(): void {
    this.fromX = this.container.x
    this.fromY = this.container.y
    const [tx, ty] = this.path[this.pathIndex]
    const pos = this.screenPos(tx, ty)
    this.toX = pos.x
    this.toY = pos.y
    this.moveStartTime = Date.now()
  }

  private returnHome(): void {
    const homePath = findPath(
      this.tileX, this.tileY,
      this.homeTileX, this.homeTileY,
      [[this.doorTileX, this.doorTileY]],
    )
    if (homePath && homePath.length > 0) {
      this.path      = homePath
      this.pathIndex = 0
      this.state     = 'RETURNING'
      this.setStatusIcon()
      this.beginNextStep()
    } else {
      this.tileX = this.homeTileX
      this.tileY = this.homeTileY
      this.depthRow = this.homeTileY
      const pos = this.screenPos(this.tileX, this.tileY)
      this.container.x = pos.x
      this.container.y = pos.y
      this.state = 'IDLE'
      this.setStatusIcon()
    }
  }

  // ── Idle wandering ────────────────────────────────────────────────────────

  private tickIdleWander(now: number): void {
    if (this.wanderActive) {
      const t = Math.min((now - this.wanderMoveStart) / WANDER_MOVE_DURATION, 1)
      this.container.x = this.wanderFromX + (this.wanderToX - this.wanderFromX) * t
      this.container.y = this.wanderFromY + (this.wanderToY - this.wanderFromY) * t
      this.character.rotation = Math.sin(now / 180) * 0.12
      this.character.y        = 0

      const [, destWTy] = this.wanderPath[this.wanderIdx]
      this.depthRow = this.tileY + (destWTy - this.tileY) * t

      if (t >= 1) {
        this.container.x = this.wanderToX
        this.container.y = this.wanderToY
        const [ntx, nty]  = this.wanderPath[this.wanderIdx]
        this.tileX        = ntx
        this.tileY        = nty
        this.depthRow      = nty
        this.character.rotation = 0
        this.wanderIdx++

        if (this.wanderIdx < this.wanderPath.length) {
          this.beginWanderStep()
        } else {
          this.wanderActive = false
          this.wanderNextAt = now + WANDER_PAUSE_MIN + Math.random() * (WANDER_PAUSE_MAX - WANDER_PAUSE_MIN)
        }
      }
    } else {
      this.character.y        = Math.sin(now / 1000 * 2) * 3
      this.character.rotation = 0
      if (now >= this.wanderNextAt) {
        this.pickWanderTarget()
      }
    }
  }

  private beginWanderStep(): void {
    this.wanderFromX     = this.container.x
    this.wanderFromY     = this.container.y
    const [tx, ty]       = this.wanderPath[this.wanderIdx]
    const pos            = this.screenPos(tx, ty)
    this.wanderToX       = pos.x
    this.wanderToY       = pos.y
    this.wanderMoveStart = Date.now()
  }

  private pickWanderTarget(): void {
    for (let attempt = 0; attempt < 12; attempt++) {
      const dx = Math.round((Math.random() * 2 - 1) * WANDER_RANGE)
      const dy = Math.round((Math.random() * 2 - 1) * WANDER_RANGE)
      if (Math.abs(dx) + Math.abs(dy) < WANDER_RANGE_MIN) continue

      const tx = this.tileX + dx
      const ty = this.tileY + dy
      if (tx < 2 || tx >= GRID_SIZE - 2 || ty < 2 || ty >= GRID_SIZE - 2) continue
      if (GRID[ty][tx] !== 0 && GRID[ty][tx] !== 1) continue

      let tooClose = false
      for (const ak of this.wanderAvoidKeys) {
        const ax = ak % GRID_SIZE
        const ay = Math.floor(ak / GRID_SIZE)
        if (Math.abs(tx - ax) + Math.abs(ty - ay) < WANDER_SPREAD_MIN) { tooClose = true; break }
      }
      if (tooClose) continue

      const path = findPath(this.tileX, this.tileY, tx, ty)
      if (path && path.length > 0) {
        this.wanderPath   = path
        this.wanderIdx    = 0
        this.wanderActive = true
        this.beginWanderStep()
        return
      }
    }
    this.wanderNextAt = Date.now() + 600
  }

  private setStatusIcon(): void {
    if (!this.statusIcon) return
    switch (this.state) {
      case 'IDLE':                    this.statusIcon.text = '💤'; break
      case 'WALKING': case 'AT_DOOR':
      case 'RETURNING':               this.statusIcon.text = '🚶'; break
      case 'WORKING':                 this.statusIcon.text = '⚒️'; break
    }
  }

  // ── Private builders ──────────────────────────────────────────────────────

  private buildSelectionRing(): void {
    this.selectionRing = new Graphics()
    this.selectionRing.ellipse(0, 2, 20, 8)
    this.selectionRing.stroke({ color: 0xFFD700, width: 2.5 })
    this.selectionRing.visible = false
    this.container.addChild(this.selectionRing)
  }

  private buildShadow(): void {
    const shadow = new Graphics()
    shadow.ellipse(0, 2, 13, 5)
    shadow.fill({ color: 0x000000, alpha: 0.38 })
    this.container.addChild(shadow)
  }

  private buildCharacter(): void {
    const gfx = new Graphics()

    switch (this.visuals.type) {
      case 'wizard':    this.drawWizard(gfx);    break
      case 'ranger':    this.drawRanger(gfx);    break
      case 'knight':    this.drawKnight(gfx);    break
      case 'alchemist': this.drawAlchemist(gfx); break
      case 'cleric':    this.drawCleric(gfx);    break
    }

    this.character.addChild(gfx)

    const labelStyle = new TextStyle({
      fontFamily: 'bold 1px monospace',
      fontSize:   11,
      fontWeight: 'bold',
      fill:       0xFFFF00,
      stroke:     { color: 0x000000, width: 3 },
      align:      'center',
    })
    const label = new Text({ text: this.name, style: labelStyle })
    label.anchor.set(0.5, 0)
    label.y = 8
    this.character.addChild(label)

    const iconStyle = new TextStyle({ fontSize: 14, align: 'center' })
    this.statusIcon = new Text({ text: '💤', style: iconStyle })
    this.statusIcon.anchor.set(0.5, 1)
    this.statusIcon.y = -64
    this.character.addChild(this.statusIcon)
  }

  // ── Character draw functions ───────────────────────────────────────────────

  /** Slot 1 — Wizard: pointed hat, flowing robes, arcane staff with orb */
  private drawWizard(gfx: Graphics): void {
    const v = this.visuals
    // Robe body
    gfx.circle(0, -20, 13)
    gfx.fill(v.color1)
    gfx.circle(-3, -24, 5)
    gfx.fill({ color: v.color2, alpha: 0.55 })
    // Head
    gfx.circle(0, -35, 7)
    gfx.fill(0xF5CBA7)
    // Hat brim
    gfx.ellipse(0, -41, 11, 4)
    gfx.fill(v.color4)
    // Hat cone
    gfx.poly([0, -62, -8, -42, 8, -42])
    gfx.fill(v.color1)
    // Staff
    gfx.rect(10, -58, 3, 46)
    gfx.fill(0x7A5230)
    // Orb
    gfx.circle(11, -61, 5)
    gfx.fill(v.color3)
    // Orb inner glow
    gfx.circle(9, -63, 2.5)
    gfx.fill({ color: 0xFFFFFF, alpha: 0.35 })
  }

  /** Slot 2 — Ranger: hooded cloak, longbow on left, quiver on back */
  private drawRanger(gfx: Graphics): void {
    const v = this.visuals
    // Cloak body
    gfx.circle(0, -19, 12)
    gfx.fill(v.color1)
    // Head
    gfx.circle(0, -33, 6.5)
    gfx.fill(0xF5CBA7)
    // Hood brim (flatter than wizard)
    gfx.ellipse(0, -38, 11, 4)
    gfx.fill(v.color2)
    // Hood peak (rounded, not sharply pointed)
    gfx.poly([-7, -53, 0, -56, 7, -53, 8, -39, -8, -39])
    gfx.fill(v.color2)
    // Bow stave (left side — vertical, suggesting a longbow)
    gfx.rect(-16, -52, 3, 44)
    gfx.fill(v.color4)
    // Bow tip notches
    gfx.poly([-18, -52, -13, -52, -13, -48, -18, -50])
    gfx.fill(v.color4)
    gfx.poly([-18, -8, -13, -8, -13, -12, -18, -10])
    gfx.fill(v.color4)
    // Bowstring
    gfx.moveTo(-13, -50).lineTo(-13, -10)
    gfx.stroke({ color: 0xDDCC88, width: 1.2 })
    // Quiver (right side, diagonal)
    gfx.roundRect(9, -44, 6, 18, 2)
    gfx.fill(v.color4)
    // Arrow shafts poking from quiver
    gfx.rect(10, -52, 1.5, 10)
    gfx.fill(0xC8A870)
    gfx.rect(12, -50, 1.5, 8)
    gfx.fill(0xC8A870)
    gfx.rect(14, -51, 1.5, 9)
    gfx.fill(0xC8A870)
    // Arrow fletchings (bright tips)
    gfx.circle(10.75, -53, 1.5)
    gfx.fill(v.color3)
    gfx.circle(12.75, -51, 1.5)
    gfx.fill(v.color3)
    gfx.circle(14.75, -52, 1.5)
    gfx.fill(v.color3)
  }

  /** Slot 3 — Knight: full plate armour, heater shield, longsword */
  private drawKnight(gfx: Graphics): void {
    const v = this.visuals
    // Armored body (chunky, rectangular)
    gfx.roundRect(-11, -37, 22, 28, 3)
    gfx.fill(v.color1)
    // Breastplate highlight
    gfx.roundRect(-7, -35, 14, 18, 2)
    gfx.fill(v.color2)
    // Red cross emblem on chest
    gfx.rect(-2, -32, 4, 12)
    gfx.fill(v.color3)
    gfx.rect(-6, -27, 12, 4)
    gfx.fill(v.color3)
    // Helmet
    gfx.roundRect(-9, -52, 18, 18, 5)
    gfx.fill(v.color1)
    // Visor slit
    gfx.roundRect(-6, -46, 12, 5, 2)
    gfx.fill({ color: 0x111111, alpha: 0.8 })
    // Red plume atop helmet
    gfx.poly([-3, -64, 0, -53, 3, -64, 2, -53, -2, -53])
    gfx.fill(v.color3)
    // Heater shield (left arm)
    gfx.poly([-24, -38, -12, -38, -12, -22, -18, -12, -24, -22])
    gfx.fill(v.color3)
    // Shield rim
    gfx.poly([-24, -38, -12, -38, -12, -22, -18, -12, -24, -22])
    gfx.stroke({ color: v.color4, width: 1.5 })
    // Shield boss
    gfx.circle(-18, -27, 3)
    gfx.fill(v.color4)
    // Sword blade (right)
    gfx.rect(12, -56, 3, 36)
    gfx.fill(v.color2)
    // Blade fuller (centre groove)
    gfx.rect(13, -54, 1, 32)
    gfx.fill({ color: 0x888888, alpha: 0.5 })
    // Crossguard
    gfx.rect(8, -23, 11, 3)
    gfx.fill(v.color4)
    // Grip
    gfx.rect(13, -20, 2, 8)
    gfx.fill(0x5C3317)
    // Pommel
    gfx.circle(14, -12, 3)
    gfx.fill(v.color4)
  }

  /** Slot 4 — Alchemist: hunched posture, wide-brim hat, bubbling flask */
  private drawAlchemist(gfx: Graphics): void {
    const v = this.visuals
    // Hunched body (offset forward to suggest leaning over)
    gfx.ellipse(2, -18, 13, 11)
    gfx.fill(v.color1)
    gfx.circle(-2, -22, 5)
    gfx.fill({ color: v.color2, alpha: 0.55 })
    // Head (slightly forward)
    gfx.circle(2, -31, 6.5)
    gfx.fill(0xF5CBA7)
    // Wide brim hat (flat, not pointed — alchemist style)
    gfx.ellipse(2, -38, 15, 5)
    gfx.fill(v.color4)
    // Hat crown (short, round dome)
    gfx.ellipse(2, -44, 10, 9)
    gfx.fill(v.color1)
    // Staff (held left hand)
    gfx.rect(-12, -48, 3, 38)
    gfx.fill(0x7A5230)
    // Round-bottom flask on staff tip
    gfx.circle(-10, -53, 8)
    gfx.fill(v.color3)
    // Flask inner glow highlight
    gfx.circle(-13, -56, 3)
    gfx.fill({ color: 0xFFFFFF, alpha: 0.25 })
    // Flask neck
    gfx.rect(-13, -46, 6, 8)
    gfx.fill(v.color4)
    // Cork stopper
    gfx.roundRect(-14, -49, 8, 4, 2)
    gfx.fill(0x8B5E3C)
    // Bubbles rising above flask
    gfx.circle(-14, -63, 2.5)
    gfx.fill({ color: v.color3, alpha: 0.55 })
    gfx.circle(-8, -68, 1.8)
    gfx.fill({ color: v.color3, alpha: 0.45 })
    gfx.circle(-12, -73, 1.4)
    gfx.fill({ color: v.color3, alpha: 0.35 })
  }

  /** Slot 5 — Cleric: wide flowing robes, holy book, cross-topped golden staff */
  private drawCleric(gfx: Graphics): void {
    const v = this.visuals
    // Wide flowing robes (broader silhouette than wizard)
    gfx.ellipse(0, -17, 16, 13)
    gfx.fill(v.color1)
    // Gold band at collar
    gfx.ellipse(0, -27, 10, 4)
    gfx.fill(v.color4)
    // Head
    gfx.circle(0, -36, 7)
    gfx.fill(0xF5CBA7)
    // White wimple / head cloth
    gfx.ellipse(0, -42, 11, 5)
    gfx.fill(v.color1)
    // Halo (stroke only — golden ring)
    gfx.circle(0, -44, 11)
    gfx.stroke({ color: v.color4, width: 2 })
    // Holy book (held left hand)
    gfx.roundRect(-12, -33, 11, 14, 2)
    gfx.fill(v.color2)
    // Book spine
    gfx.rect(-12, -33, 2, 14)
    gfx.fill(v.color4)
    // Book page lines (decorative)
    gfx.rect(-9, -30, 7, 1.5)
    gfx.fill({ color: v.color4, alpha: 0.4 })
    gfx.rect(-9, -26, 7, 1.5)
    gfx.fill({ color: v.color4, alpha: 0.4 })
    gfx.rect(-9, -22, 7, 1.5)
    gfx.fill({ color: v.color4, alpha: 0.4 })
    // Gold clasp
    gfx.circle(-7, -26, 2)
    gfx.fill(v.color4)
    // Golden staff (right hand)
    gfx.rect(9, -62, 3, 52)
    gfx.fill(v.color4)
    // Cross horizontal bar
    gfx.rect(5, -60, 11, 3)
    gfx.fill(v.color4)
    // Warm glow around cross
    gfx.circle(10, -60, 8)
    gfx.fill({ color: v.color3, alpha: 0.35 })
  }
}
