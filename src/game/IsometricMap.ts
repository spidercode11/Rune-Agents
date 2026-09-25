import { Application, Container, Graphics, Text, TextStyle, Sprite, FederatedPointerEvent, Assets, Texture } from 'pixi.js'
import { Building, BuildingConfig } from './Building'
import { buildDecorations } from './Decorations'
import {
  ProjectBuilding, ProjectConfig, ProjectType,
  isValidPlacement, drawGhost,
} from './ProjectBuilding'
import { AgentManager } from './AgentManager'
import { AgentRoster } from './AgentRoster'

// ─── Constants ────────────────────────────────────────────────────────────────

export const TILE_W    = 64   // full pixel width of a diamond tile
export const TILE_H    = 32   // full pixel height of a diamond tile (TILE_W / 2)
export const GRID_SIZE = 36

// Town Hall perimeter ring bounds (used by auto-path generation)
export const RING_TX_MIN = 15
export const RING_TX_MAX = 20
export const RING_TY_MIN = 15
export const RING_TY_MAX = 20

// Camera panning speed
const KEY_PAN_SPEED = 7

// ─── Tile types ───────────────────────────────────────────────────────────────

// 0 = grass, 1 = path, 3 = beach/sand, 9 = building footprint
export type TileType = 0 | 1 | 3 | 9

// ─── Colors ───────────────────────────────────────────────────────────────────

const SAND_COL       = 0xC8A96E   // warm beach sand (inner ring, d=1)
const SAND_DARK_COL  = 0xA8854A   // slightly darker sand (outer ring, d=0)
const GRASS_COL       = 0x2F5A24   // dark grass base fill color
const GRASS_COL_LIGHT = 0x3E7530   // lighter fleck, scattered for grass texture noise
const GRASS_COL_DARK  = 0x1E3F17   // darker fleck, scattered for grass texture noise

// ─── Grid definition ──────────────────────────────────────────────────────────

export const GRID: TileType[][] = (() => {
  const g: TileType[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(0) as TileType[]
  )

  // ── Town Hall perimeter plaza (cobblestone ring around 4×4 at (16,16)-(19,19)) ──
  for (let tx = 15; tx <= 20; tx++) { g[15][tx] = 1;  g[20][tx] = 1 }
  for (let ty = 16; ty <= 19; ty++) { g[ty][15] = 1;  g[ty][20] = 1 }

  // ── Spoke paths (hub-and-spoke from Town Hall perimeter to each building door) ──
  const spokes: [number, number][] = [
    // NW → Forge door (6,7):   ring (15,15) → diagonal SW → (6,7)
    [14,14],[13,13],[12,12],[11,11],[10,10],[9,9],[8,8],[7,7],[6,7],
    // NE → Tavern door (27,7): ring (20,15) → diagonal NE → (27,7)
    [21,14],[22,13],[23,12],[24,11],[25,10],[26,9],[27,8],[27,7],
    // SW → Library door (6,26):ring (15,20) → diagonal SW → (6,26)
    [14,21],[13,22],[12,23],[11,24],[10,25],[9,26],[8,26],[7,26],[6,26],
  ]
  for (const [tx, ty] of spokes) g[ty][tx] = 1

  // ── 2-tile beach border around the entire grid perimeter ──────────────────
  for (let ty = 0; ty < GRID_SIZE; ty++) {
    for (let tx = 0; tx < GRID_SIZE; tx++) {
      const d = Math.min(tx, GRID_SIZE - 1 - tx, ty, GRID_SIZE - 1 - ty)
      if (d <= 1 && g[ty][tx] !== 1) g[ty][tx] = 3
    }
  }

  return g
})()

// ─── Coordinate conversion ────────────────────────────────────────────────────

export function toScreen(
  tileX: number,
  tileY: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  return {
    x: (tileX - tileY) * (TILE_W / 2) + offsetX,
    y: (tileX + tileY) * (TILE_H / 2) + offsetY,
  }
}

export function toTile(
  screenX: number,
  screenY: number,
  offsetX: number,
  offsetY: number,
): { x: number; y: number } {
  const rx = screenX - offsetX
  const ry = screenY - offsetY
  return {
    x: Math.floor((rx / (TILE_W / 2) + ry / (TILE_H / 2)) / 2),
    y: Math.floor((ry / (TILE_H / 2) - rx / (TILE_W / 2)) / 2),
  }
}

// ─── IsometricMap class ───────────────────────────────────────────────────────

const MIN_SCALE = 0.6
const MAX_SCALE = 2.5

// ─── Building definitions ─────────────────────────────────────────────────────

const BUILDING_CONFIGS: BuildingConfig[] = [
  {
    id: 'town_hall', name: 'Town Hall',
    gridOrigin: [16, 16], footprint: [4, 4], doorTile: [17, 20],
    roofColor: 0x6A1818, wallColor: 0xD0C4AA, trimColor: 0xD4A844,
    chimneyEnabled: false, signText: 'Town Hall', wallHeight: 54,
  },
  {
    id: 'forge', name: 'The Forge',
    gridOrigin: [4, 4], footprint: [3, 3], doorTile: [6, 7],
    roofColor: 0x28282E, wallColor: 0x453428, trimColor: 0x6A6A6A,
    chimneyEnabled: true, signText: 'The Forge', wallHeight: 38,
  },
  {
    id: 'library', name: 'The Library',
    gridOrigin: [4, 27], footprint: [3, 3], doorTile: [6, 26],
    roofColor: 0x283A52, wallColor: 0xCCC0A4, trimColor: 0x8B6914,
    chimneyEnabled: false, signText: 'The Library', wallHeight: 46,
  },
  {
    id: 'tavern', name: 'The Tavern',
    gridOrigin: [27, 4], footprint: [3, 3], doorTile: [27, 7],
    roofColor: 0x7A6030, wallColor: 0xC0A07A, trimColor: 0x4A3018,
    chimneyEnabled: true, signText: 'The Tavern', wallHeight: 38,
  },
]

export class IsometricMap {
  readonly container        = new Container()
  /** Fixed-position overlay (add to app.stage directly, not this.container). */
  readonly overlayContainer = new Container()
  private groundLayer     = new Container()   // grass + beach
  private pathLayer       = new Container()   // path tiles (static + project trails)
  private entityLayer     = new Container()   // buildings + agents — depth-sorted each frame
  private decorationLayer = new Container()   // trees, bushes, fountain
  private pathDotsLayer   = new Container()   // A* path visualisation dots
  private ghostLayer      = new Container()   // placement preview ghost
  private tooltipLayer    = new Container()   // building name tooltips (topmost)

  // ── Project building placement state ──────────────────────────────────────
  private placementMode: 'none' | ProjectType = 'none'
  private placedProjects: ProjectBuilding[]   = []
  private nextProjectId = 1
  private lastGhostTx   = -1
  private lastGhostTy   = -1
  private agentManager    = new AgentManager()
  private roster          = new AgentRoster()
  private buildings       = BUILDING_CONFIGS.map(cfg => new Building(cfg))
  private offsetX     = 0
  private offsetY     = 0
  private pathTexture!:     Texture
  private townHallTexture!: Texture

  // Pan state
  private isDragging  = false
  private dragStartX  = 0
  private dragStartY  = 0
  private panStartX   = 0
  private panStartY   = 0
  private pointerMoved = false   // true once pointer travels >4px after down

  // Zoom state
  private scale = 1.0

  // Held keys for WASD / arrow key panning
  private readonly heldKeys  = new Set<string>()
  private readonly onKeyDown = (e: KeyboardEvent) => this.heldKeys.add(e.key)
  private readonly onKeyUp   = (e: KeyboardEvent) => this.heldKeys.delete(e.key)

  async init(app: Application): Promise<void> {
    this.offsetX = app.screen.width / 2
    this.offsetY = 40

    this.pathTexture = await Assets.load<Texture>('/assets/tiles/Trailpath3.png')
    this.pathTexture.source.scaleMode = 'nearest'

    this.townHallTexture = await Assets.load<Texture>('/assets/tiles/TownHouse.png')
    this.townHallTexture.source.scaleMode = 'nearest'

    // Layer order: ground → path → decorations → pathDots → entities → ghost → tooltips
    // entityLayer holds buildings + agents and is depth-sorted each frame so that
    // characters appear in front of buildings when south of them and behind when north.
    this.entityLayer.sortableChildren = true
    this.container.addChild(this.groundLayer)
    this.container.addChild(this.pathLayer)
    this.container.addChild(this.decorationLayer)
    this.container.addChild(this.pathDotsLayer)
    this.container.addChild(this.entityLayer)
    this.container.addChild(this.ghostLayer)
    this.container.addChild(this.tooltipLayer)

    // Mark building footprints as non-walkable before drawing tiles
    for (const building of this.buildings) {
      for (const { tx, ty } of building.footprintTiles()) {
        GRID[ty][tx] = 9
      }
    }

    this.drawTiles()

    // Init buildings — all go into entityLayer for depth sorting with agents.
    for (const building of this.buildings) {
      const tex = building.cfg.id === 'town_hall' ? this.townHallTexture : undefined
      building.init(this.offsetX, this.offsetY, this.tooltipLayer, tex)
      building.zIndex = building.depthRow
      this.entityLayer.addChild(building)
    }

    // Add trees, bushes, fountain
    const buildingBoxes = BUILDING_CONFIGS.map(cfg => ({
      ox: cfg.gridOrigin[0], oy: cfg.gridOrigin[1],
      fw: cfg.footprint[0],  fh: cfg.footprint[1],
    }))
    this.decorationLayer.addChild(await buildDecorations(this.offsetX, this.offsetY, buildingBoxes))

    // Spawn all agents and set up the roster overlay
    this.agentManager.init(this.offsetX, this.offsetY, this.entityLayer)
    this.roster.attach(this.agentManager.all)
    this.roster.container.x = 8
    this.roster.container.y = 8
    this.overlayContainer.addChild(this.roster.container)

    // ── Pixi pointer events (pan + hover) ──────────────────────────────────
    app.stage.eventMode = 'static'
    app.stage.hitArea   = app.screen

    app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
      if (this.placementMode !== 'none') {
        const localX = (e.global.x - this.container.x) / this.scale
        const localY = (e.global.y - this.container.y) / this.scale
        const { x: tx, y: ty } = toTile(localX, localY, this.offsetX, this.offsetY)
        if (isValidPlacement(tx, ty, this.placementMode) && this.placedProjects.length < 6) {
          this.placeProject(tx, ty, this.placementMode)
        }
        return
      }
      this.isDragging   = true
      this.pointerMoved = false
      this.dragStartX   = e.global.x
      this.dragStartY   = e.global.y
      this.panStartX    = this.container.x
      this.panStartY    = this.container.y
    })

    app.stage.on('pointermove', (e: FederatedPointerEvent) => {
      if (this.isDragging) {
        const dx = e.global.x - this.dragStartX
        const dy = e.global.y - this.dragStartY
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this.pointerMoved = true
        this.container.x = this.panStartX + dx
        this.container.y = this.panStartY + dy
      } else {
        this.onPointerMove(e.global.x, e.global.y)
        if (this.placementMode !== 'none') {
          this.updateGhost(e.global.x, e.global.y)
        }
      }
    })

    app.stage.on('pointerup', (e: FederatedPointerEvent) => {
      if (this.isDragging && !this.pointerMoved) {
        this.onMapClick(e.global.x, e.global.y)
      }
      this.isDragging = false
    })
    app.stage.on('pointerupoutside', () => { this.isDragging = false })

    // ── Native wheel event (scroll wheel + trackpad pinch) ─────────────────
    app.canvas.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault()
      const factor   = e.ctrlKey ? 0.008 : 0.0012
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale * (1 - e.deltaY * factor)))
      const rect   = app.canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const worldX = (mouseX - this.container.x) / this.scale
      const worldY = (mouseY - this.container.y) / this.scale
      this.scale        = newScale
      this.container.scale.set(newScale)
      this.container.x  = mouseX - worldX * newScale
      this.container.y  = mouseY - worldY * newScale
    }, { passive: false })

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup',   this.onKeyUp)

    // ── Project building placement shortcuts ───────────────────────────────
    window.addEventListener('keydown', this.onPlacementKey)
  }

  update(): void {
    if (!this.isDragging) {
      if (this.heldKeys.has('ArrowUp')    || this.heldKeys.has('w')) this.container.y += KEY_PAN_SPEED
      if (this.heldKeys.has('ArrowDown')  || this.heldKeys.has('s')) this.container.y -= KEY_PAN_SPEED
      if (this.heldKeys.has('ArrowLeft')  || this.heldKeys.has('a')) this.container.x += KEY_PAN_SPEED
      if (this.heldKeys.has('ArrowRight') || this.heldKeys.has('d')) this.container.x -= KEY_PAN_SPEED
    }
    this.agentManager.update()
    // Update agent depth so they sort correctly against buildings — both use
    // a tile-row basis (see Agent.depthRow / Building.depthRow) rather than
    // raw screen Y, which conflates a tile's X and Y and misjudges buildings
    // whose door isn't at the extreme SE corner of their footprint.
    for (const agent of this.agentManager.all) {
      agent.container.zIndex = agent.depthRow
    }
    this.roster.update(this.agentManager.selected)
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup',   this.onKeyUp)
    window.removeEventListener('keydown', this.onPlacementKey)
  }

  // ── Placement key handler ─────────────────────────────────────────────────

  private readonly onPlacementKey = (e: KeyboardEvent) => {
    if (e.key === 't' || e.key === 'T') {
      this.placementMode = this.placementMode === 'tower' ? 'none' : 'tower'
      if (this.placementMode === 'none') this.clearGhost()
    } else if (e.key === 'c' || e.key === 'C') {
      this.placementMode = this.placementMode === 'castle' ? 'none' : 'castle'
      if (this.placementMode === 'none') this.clearGhost()
    } else if (e.key === 'Escape') {
      this.placementMode = 'none'
      this.clearGhost()
    }
  }

  // ── Ghost management ──────────────────────────────────────────────────────

  private clearGhost(): void {
    this.ghostLayer.removeChildren()
    this.lastGhostTx = -1
    this.lastGhostTy = -1
  }

  private updateGhost(screenX: number, screenY: number): void {
    if (this.placementMode === 'none') return
    const localX = (screenX - this.container.x) / this.scale
    const localY = (screenY - this.container.y) / this.scale
    const { x: tx, y: ty } = toTile(localX, localY, this.offsetX, this.offsetY)
    if (tx === this.lastGhostTx && ty === this.lastGhostTy) return
    this.lastGhostTx = tx
    this.lastGhostTy = ty
    this.ghostLayer.removeChildren()
    if (tx >= 0 && tx < GRID_SIZE && ty >= 0 && ty < GRID_SIZE) {
      const valid = isValidPlacement(tx, ty, this.placementMode) && this.placedProjects.length < 6
      this.ghostLayer.addChild(drawGhost(this.placementMode, tx, ty, this.offsetX, this.offsetY, valid))
    }
  }

  // ── Place / remove project buildings ─────────────────────────────────────

  private placeProject(ox: number, oy: number, type: ProjectType): void {
    const hw = TILE_W / 2, hh = TILE_H / 2
    const cfg: ProjectConfig = {
      type,
      gridOrigin: [ox, oy],
      name: `Project ${this.nextProjectId++}`,
    }
    const pb = new ProjectBuilding(cfg)

    // Mark footprint tiles non-walkable in GRID
    for (const { tx, ty } of pb.footprintTiles()) GRID[ty][tx] = 9

    // Mark auto-path tiles in GRID and render them using the same Trailpath3.png
    // sprite (with diamond mask) as the static path tiles drawn in drawTiles().
    const pathCtr = new Container()
    for (const [ptx, pty] of pb.pathTiles) {
      if (GRID[pty][ptx] === 0) {
        GRID[pty][ptx] = 1
        const { x, y } = toScreen(ptx, pty, this.offsetX, this.offsetY)
        const mask = new Graphics()
          .poly([x, y, x + hw, y + hh, x, y + TILE_H, x - hw, y + hh])
          .fill(0xffffff)
        const sprite = new Sprite(this.pathTexture)
        sprite.anchor.set(0.5, 0)
        sprite.x      = x
        sprite.y      = y
        sprite.width  = TILE_W
        sprite.height = TILE_H
        sprite.mask   = mask
        pathCtr.addChild(mask)
        pathCtr.addChild(sprite)
      }
    }
    // Trail tiles go on pathLayer (same layer as static GRID=1 tiles) so they
    // are always rendered beneath every building, including Town Hall.
    this.pathLayer.addChild(pathCtr)

    // Init and render the building
    pb.init(this.offsetX, this.offsetY, () => this.removeProject(pb, pathCtr))
    pb.zIndex = pb.depthRow
    this.entityLayer.addChild(pb)
    this.placedProjects.push(pb)

    // Exit placement mode after placing
    this.placementMode = 'none'
    this.clearGhost()

    console.log(`Placed ${type} "${cfg.name}" at (${ox},${oy})`)
  }

  private removeProject(pb: ProjectBuilding, pathGfx: Container): void {
    // Restore footprint tiles to grass
    for (const { tx, ty } of pb.footprintTiles()) GRID[ty][tx] = 0

    // Restore path tiles to grass (only if not shared with another building)
    for (const [ptx, pty] of pb.pathTiles) {
      let sharedPath = false
      for (const other of this.placedProjects) {
        if (other === pb) continue
        if (other.pathTiles.some(([ox, oy]) => ox === ptx && oy === pty)) {
          sharedPath = true; break
        }
      }
      if (!sharedPath) GRID[pty][ptx] = 0
    }

    this.pathLayer.removeChild(pathGfx)
    this.entityLayer.removeChild(pb)
    this.placedProjects = this.placedProjects.filter(p => p !== pb)
    console.log(`Removed ${pb.cfg.type} "${pb.cfg.name}"`)
  }

  // ── Pathfinding & click ────────────────────────────────────────────────────

  private onMapClick(screenX: number, screenY: number): void {
    const localX = (screenX - this.container.x) / this.scale
    const localY = (screenY - this.container.y) / this.scale

    // First: check if the user clicked on an agent — selection takes priority
    if (this.agentManager.trySelectAt(localX, localY)) return

    // Second: only dispatch if the selected agent is idle
    if (!this.agentManager.selectedIsIdle) return

    const { x: tx, y: ty } = toTile(localX, localY, this.offsetX, this.offsetY)

    // Check core buildings
    for (const cfg of BUILDING_CONFIGS) {
      const [ox, oy] = cfg.gridOrigin
      const [fw, fh] = cfg.footprint
      if (tx >= ox && tx < ox + fw && ty >= oy && ty < oy + fh) {
        this.dispatchAgentTo(cfg.doorTile[0], cfg.doorTile[1], [[cfg.doorTile[0], cfg.doorTile[1]]])
        return
      }
    }

    // Check project buildings
    for (const pb of this.placedProjects) {
      for (const { tx: ftx, ty: fty } of pb.footprintTiles()) {
        if (tx === ftx && ty === fty) {
          const [dtx, dty] = pb.doorTile()
          this.dispatchAgentTo(dtx, dty, [[dtx, dty]])
          return
        }
      }
    }

    // Clicked empty tile — clear existing path dots
    this.pathDotsLayer.removeChildren()
  }

  private dispatchAgentTo(goalTx: number, goalTy: number, doorTiles: [number, number][]): void {
    this.pathDotsLayer.removeChildren()

    const path = this.agentManager.dispatchSelected(goalTx, goalTy, doorTiles)

    if (path === null || path.length === 0) {
      // "No path" indicator at goal tile
      const { x, y } = toScreen(goalTx, goalTy, this.offsetX, this.offsetY)
      const gfx = new Graphics()
      gfx.circle(x, y + TILE_H / 2, 8)
      gfx.fill({ color: 0xFF3333, alpha: 0.7 })
      this.pathDotsLayer.addChild(gfx)

      const style = new TextStyle({ fontSize: 12, fill: 0xFF3333,
        stroke: { color: 0x000000, width: 3 }, fontWeight: 'bold' })
      const label = new Text({ text: 'No path!', style })
      label.anchor.set(0.5, 1)
      label.x = x
      label.y = y - 4
      this.pathDotsLayer.addChild(label)

      setTimeout(() => { this.pathDotsLayer.removeChildren() }, 2000)
      return
    }

    // Show golden path dots briefly
    const gfx = new Graphics()
    for (const [ptx, pty] of path) {
      const { x, y } = toScreen(ptx, pty, this.offsetX, this.offsetY)
      gfx.circle(x, y + TILE_H / 2, 3.5)
      gfx.fill({ color: 0xFFD700, alpha: 0.85 })
      gfx.circle(x, y + TILE_H / 2, 1.5)
      gfx.fill({ color: 0xFFFFAA, alpha: 0.95 })
    }
    this.pathDotsLayer.addChild(gfx)
    setTimeout(() => { this.pathDotsLayer.removeChildren() }, 1500)
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  private drawTiles(): void {
    const hw = TILE_W / 2
    const hh = TILE_H / 2

    for (let ty = 0; ty < GRID_SIZE; ty++) {
      for (let tx = 0; tx < GRID_SIZE; tx++) {
        const { x, y } = toScreen(tx, ty, this.offsetX, this.offsetY)
        const tileType = GRID[ty][tx]

        if (tileType === 0 || tileType === 9) {
          // Grass tile (type 9 = building footprint — building covers the floor)
          const gfx = new Graphics()
            .poly([x, y,  x + hw, y + hh,  x, y + TILE_H,  x - hw, y + hh])
            .fill(GRASS_COL)

          // Scatter light/dark flecks across the diamond (parallelogram param:
          // u,v in [0,1] sweep the full rhombus from the top corner) to break
          // up the flat fill into a mottled, grassy texture.
          const speckleCount = 5 + Math.floor(Math.random() * 4)
          for (let i = 0; i < speckleCount; i++) {
            const u  = Math.random()
            const v  = Math.random()
            const px = x + hw * (u - v)
            const py = y + hh * (u + v)
            gfx.circle(px, py, 0.8 + Math.random() * 0.9)
            gfx.fill({ color: Math.random() < 0.5 ? GRASS_COL_LIGHT : GRASS_COL_DARK, alpha: 0.5 })
          }

          this.groundLayer.addChild(gfx)

        } else if (tileType === 1) {
          // Path tile
          const mask = new Graphics()
            .poly([x, y,  x + hw, y + hh,  x, y + TILE_H,  x - hw, y + hh])
            .fill(0xffffff)
          const sprite = new Sprite(this.pathTexture)
          sprite.anchor.set(0.5, 0)
          sprite.x      = x
          sprite.y      = y
          sprite.width  = TILE_W
          sprite.height = TILE_H
          sprite.mask   = mask
          this.pathLayer.addChild(mask)
          this.pathLayer.addChild(sprite)

        } else if (tileType === 3) {
          // Beach/sand tile — outer ring (d=0) slightly darker than inner ring (d=1)
          const d   = Math.min(tx, GRID_SIZE - 1 - tx, ty, GRID_SIZE - 1 - ty)
          const col = d === 0 ? SAND_DARK_COL : SAND_COL
          const gfx = new Graphics()
            .poly([x, y,  x + hw, y + hh,  x, y + TILE_H,  x - hw, y + hh])
            .fill(col)
          this.groundLayer.addChild(gfx)
        }
      }
    }
  }

  // ── Hover ──────────────────────────────────────────────────────────────────

  private onPointerMove(_screenX: number, _screenY: number): void {
    // no tile hover highlight
  }
}
