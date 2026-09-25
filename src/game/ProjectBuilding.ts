import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import {
  toScreen, TILE_W, TILE_H, GRID, GRID_SIZE,
  RING_TX_MIN, RING_TX_MAX, RING_TY_MIN, RING_TY_MAX,
} from './IsometricMap'
import { findPath } from './Pathfinder'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjectType = 'tower' | 'castle'

export interface ProjectConfig {
  type:       ProjectType
  gridOrigin: [number, number]
  name:       string
}

export const FOOTPRINT: Record<ProjectType, [number, number]> = {
  tower:  [2, 2],
  castle: [3, 3],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function darken(color: number, f: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xFF) * f))
  const g = Math.min(255, Math.floor(((color >>  8) & 0xFF) * f))
  const b = Math.min(255, Math.floor( (color        & 0xFF) * f))
  return (r << 16) | (g << 8) | b
}

function wallPt(
  ax: number, ay: number, bx: number, by: number,
  wallH: number, u: number, v: number,
): [number, number] {
  return [ax + (bx - ax) * u, ay + (by - ay) * u - wallH * (1 - v)]
}

function isoCorners(
  ox: number, oy: number, fw: number, fh: number,
  offsetX: number, offsetY: number,
) {
  const hw = TILE_W / 2, hh = TILE_H / 2
  const tTop    = toScreen(ox,          oy,          offsetX, offsetY)
  const tRight  = toScreen(ox + fw - 1, oy,          offsetX, offsetY)
  const tBottom = toScreen(ox + fw - 1, oy + fh - 1, offsetX, offsetY)
  const tLeft   = toScreen(ox,          oy + fh - 1, offsetX, offsetY)
  return {
    topX:    tTop.x,
    topY:    tTop.y,
    rightX:  tRight.x  + hw,
    rightY:  tRight.y  + hh,
    bottomX: tBottom.x,
    bottomY: tBottom.y + TILE_H,
    leftX:   tLeft.x   - hw,
    leftY:   tLeft.y   + hh,
  }
}

// ─── Auto-path generation ─────────────────────────────────────────────────────

function ringTiles(): [number, number][] {
  const ring: [number, number][] = []
  for (let tx = RING_TX_MIN; tx <= RING_TX_MAX; tx++) {
    ring.push([tx, RING_TY_MIN])
    ring.push([tx, RING_TY_MAX])
  }
  for (let ty = RING_TY_MIN + 1; ty < RING_TY_MAX; ty++) {
    ring.push([RING_TX_MIN, ty])
    ring.push([RING_TX_MAX, ty])
  }
  return ring
}

export function generateAutoPath(doorTx: number, doorTy: number): [number, number][] {
  // Find the closest ring tile by Manhattan distance
  const ring = ringTiles()
  let best = ring[0]
  let bestDist = Infinity
  for (const [rx, ry] of ring) {
    const d = Math.abs(doorTx - rx) + Math.abs(doorTy - ry)
    if (d < bestDist) { bestDist = d; best = [rx, ry] }
  }

  // Use A* so the trail avoids building footprints (GRID=9) and beach tiles (GRID=3)
  // The door tile is treated as always-walkable since it may be on a grass tile
  // adjacent to the (not-yet-committed) building footprint.
  const result = findPath(doorTx, doorTy, best[0], best[1], [[doorTx, doorTy]])
  if (!result) return []

  // findPath returns start-exclusive, goal-inclusive.
  // Drop the last tile (the ring tile) — it is already GRID=1 and should not be
  // re-marked or re-rendered.
  return result.slice(0, -1)
}

// ─── Placement validation ─────────────────────────────────────────────────────

export function isValidPlacement(ox: number, oy: number, type: ProjectType): boolean {
  const [fw, fh] = FOOTPRINT[type]
  for (let ty = oy; ty < oy + fh; ty++) {
    for (let tx = ox; tx < ox + fw; tx++) {
      if (tx < 0 || tx >= GRID_SIZE || ty < 0 || ty >= GRID_SIZE) return false
      const d = Math.min(tx, GRID_SIZE - 1 - tx, ty, GRID_SIZE - 1 - ty)
      if (d <= 1) return false       // beach border
      if (GRID[ty][tx] !== 0) return false  // must be open grass
    }
  }
  // Door tile (below footprint) must be reachable
  const doorTy = oy + fh
  if (doorTy >= GRID_SIZE) return false
  const doorType = GRID[doorTy][ox]
  if (doorType !== 0 && doorType !== 1) return false
  return true
}

// ─── Ghost (placement preview) ────────────────────────────────────────────────

export function drawGhost(
  type: ProjectType, tx: number, ty: number,
  offsetX: number, offsetY: number, valid: boolean,
): Container {
  const ctr  = new Container()
  ctr.alpha  = 0.60
  const [fw, fh] = FOOTPRINT[type]
  const wallH = type === 'tower' ? 52 : 44
  const tint  = valid ? 0x44FF88 : 0xFF4444

  const { topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY } =
    isoCorners(tx, ty, fw, fh, offsetX, offsetY)

  const g = new Graphics()
  g.poly([topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY])
  g.fill({ color: tint, alpha: 0.25 })
  g.poly([leftX, leftY, bottomX, bottomY, bottomX, bottomY - wallH, leftX, leftY - wallH])
  g.fill({ color: tint, alpha: 0.35 })
  g.poly([rightX, rightY, bottomX, bottomY, bottomX, bottomY - wallH, rightX, rightY - wallH])
  g.fill({ color: tint, alpha: 0.45 })
  g.poly([topX, topY - wallH, rightX, rightY - wallH, bottomX, bottomY - wallH, leftX, leftY - wallH])
  g.fill({ color: tint, alpha: 0.35 })
  g.stroke({ color: tint, width: 2 })

  if (type === 'tower') {
    const rMidX = (topX + rightX + bottomX + leftX) / 4
    const rMidY = (topY + rightY + bottomY + leftY) / 4 - wallH
    g.poly([topX, topY - wallH, rightX, rightY - wallH, bottomX, bottomY - wallH,
            leftX, leftY - wallH, rMidX, rMidY - 40])
    g.fill({ color: tint, alpha: 0.30 })
    g.stroke({ color: tint, width: 1.5 })
  }

  const hintStyle = new TextStyle({
    fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold',
    fill: valid ? 0x44FF88 : 0xFF4444,
    stroke: { color: 0x000000, width: 3 },
  })
  const hint = new Text({ text: valid ? 'Click to place' : 'Cannot place here', style: hintStyle })
  hint.anchor.set(0.5, 1)
  hint.x = (leftX + rightX) / 2
  hint.y = topY - wallH - 8
  ctr.addChild(g)
  ctr.addChild(hint)
  return ctr
}

// ─── ProjectBuilding class ────────────────────────────────────────────────────

export class ProjectBuilding extends Container {
  private hoverGfx = new Graphics()
  readonly pathTiles: [number, number][]

  /**
   * Tile row (max ty) of the footprint's south edge — used for depth sorting
   * against agents, matched against Agent.depthRow (same tile-row basis).
   */
  depthRow = 0

  constructor(readonly cfg: ProjectConfig) {
    super()
    const [ox, oy] = cfg.gridOrigin
    const [, fh]   = FOOTPRINT[cfg.type]
    this.pathTiles = generateAutoPath(ox, oy + fh)
  }

  get fw(): number { return FOOTPRINT[this.cfg.type][0] }
  get fh(): number { return FOOTPRINT[this.cfg.type][1] }

  footprintTiles(): Array<{ tx: number; ty: number }> {
    const [ox, oy] = this.cfg.gridOrigin
    const tiles: Array<{ tx: number; ty: number }> = []
    for (let ty = oy; ty < oy + this.fh; ty++)
      for (let tx = ox; tx < ox + this.fw; tx++)
        tiles.push({ tx, ty })
    return tiles
  }

  doorTile(): [number, number] {
    const [ox, oy] = this.cfg.gridOrigin
    return [ox, oy + this.fh]
  }

  init(offsetX: number, offsetY: number, onRemove: () => void): void {
    const [ox, oy] = this.cfg.gridOrigin
    const fw = this.fw, fh = this.fh
    const wallH = this.cfg.type === 'tower' ? 52 : 44

    const { topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY } =
      isoCorners(ox, oy, fw, fh, offsetX, offsetY)

    this.depthRow = oy + fh - 1

    if (this.cfg.type === 'tower') {
      this.drawTower(topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY, wallH)
    } else {
      this.drawCastle(topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY, wallH)
    }

    // Hover outline
    this.hoverGfx.poly([
      topX, topY - wallH, rightX, rightY - wallH,
      rightX, rightY, bottomX, bottomY, leftX, leftY, leftX, leftY - wallH,
    ])
    this.hoverGfx.stroke({ color: 0xFF4444, width: 2.5 })
    this.hoverGfx.visible = false
    this.addChild(this.hoverGfx)

    // Hit area
    const hit = new Graphics()
    hit.poly([
      topX, topY - wallH, rightX, rightY - wallH,
      rightX, rightY, bottomX, bottomY, leftX, leftY, leftX, leftY - wallH,
    ])
    hit.fill({ color: 0x000000, alpha: 0.001 })
    hit.eventMode = 'static'
    hit.cursor    = 'pointer'
    this.addChild(hit)

    hit.on('pointerover', () => { this.hoverGfx.visible = true })
    hit.on('pointerout',  () => { this.hoverGfx.visible = false })
    hit.on('pointerdown', (e) => { e.stopPropagation(); onRemove() })
  }

  // ── Tower (2×2) ─────────────────────────────────────────────────────────────

  private drawTower(
    topX: number, topY: number,
    rightX: number, rightY: number,
    bottomX: number, bottomY: number,
    leftX: number, leftY: number,
    wallH: number,
  ): void {
    const wallColor = 0x484858
    const roofColor = 0x321060
    const trimColor = 0x9966CC
    const g = new Graphics()

    // Base
    g.poly([topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY])
    g.fill(0x484458); g.stroke({ color: 0x383448, width: 1 })

    // Left wall
    g.poly([leftX, leftY, bottomX, bottomY, bottomX, bottomY - wallH, leftX, leftY - wallH])
    g.fill(darken(wallColor, 0.60)); g.stroke({ color: darken(wallColor, 0.42), width: 1 })

    // Right wall
    g.poly([rightX, rightY, bottomX, bottomY, bottomX, bottomY - wallH, rightX, rightY - wallH])
    g.fill(darken(wallColor, 0.82)); g.stroke({ color: darken(wallColor, 0.58), width: 1 })

    // Roof diamond
    g.poly([topX, topY - wallH, rightX, rightY - wallH, bottomX, bottomY - wallH, leftX, leftY - wallH])
    g.fill(roofColor); g.stroke({ color: darken(roofColor, 0.60), width: 1.5 })

    // Crenellations
    const edges: [number, number, number, number][] = [
      [topX, topY - wallH, rightX, rightY - wallH],
      [rightX, rightY - wallH, bottomX, bottomY - wallH],
      [bottomX, bottomY - wallH, leftX, leftY - wallH],
      [leftX, leftY - wallH, topX, topY - wallH],
    ]
    for (const [ax, ay, bx, by] of edges) {
      const dx = bx - ax, dy = by - ay
      for (let m = 0; m < 3; m++) {
        const t0 = 0.10 + m * 0.28, t1 = t0 + 0.10
        g.poly([ax + dx * t0, ay + dy * t0, ax + dx * t1, ay + dy * t1,
                ax + dx * t1, ay + dy * t1 - 5, ax + dx * t0, ay + dy * t0 - 5])
        g.fill(0x5A5A6A); g.stroke({ color: 0x3A3A4A, width: 0.5 })
      }
    }

    // Conical spire
    const coneH = 40
    const rMidX = (topX + rightX + bottomX + leftX) / 4
    const rMidY = (topY + rightY + bottomY + leftY) / 4 - wallH
    g.poly([topX, topY - wallH, rightX, rightY - wallH, bottomX, bottomY - wallH,
            leftX, leftY - wallH, rMidX, rMidY - coneH])
    g.fill(roofColor); g.stroke({ color: trimColor, width: 1.5 })
    g.moveTo(rMidX - 4, rMidY - coneH * 0.25)
    g.lineTo(rMidX + 4, rMidY - coneH * 0.55)
    g.stroke({ color: trimColor, width: 1.5 })

    // Crystal orb
    g.circle(rMidX, rMidY - coneH, 4); g.fill(0x66AAFF)
    g.circle(rMidX, rMidY - coneH, 2); g.fill(0xCCEEFF)

    // Front iron-banded door
    const [d1x, d1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.30, 0.45)
    const [d2x, d2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.70, 0.45)
    const [d3x, d3y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.70, 1.0)
    const [d4x, d4y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.30, 1.0)
    g.poly([d1x, d1y, d2x, d2y, d3x, d3y, d4x, d4y]); g.fill(0x3A2A1E)
    for (let b = 0; b < 2; b++) {
      const bv = 0.52 + b * 0.22
      const [bx1, by1] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.30, bv)
      const [bx2, by2] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.70, bv)
      g.moveTo(bx1, by1); g.lineTo(bx2, by2); g.stroke({ color: 0x888888, width: 1.5 })
    }

    // Archer slit
    const [as1x, as1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.42, 0.15)
    const [as2x, as2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.58, 0.15)
    const [as3x, as3y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.58, 0.42)
    const [as4x, as4y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.42, 0.42)
    g.poly([as1x, as1y, as2x, as2y, as3x, as3y, as4x, as4y]); g.fill(0x4A7ACC)

    // Ivy on right wall
    for (let i = 0; i < 6; i++) {
      const [ix, iy] = wallPt(rightX, rightY, bottomX, bottomY, wallH,
        0.10 + (i % 3) * 0.30, 0.30 + Math.floor(i / 3) * 0.40)
      g.circle(ix, iy, 2 + (i % 2)); g.fill({ color: 0x3A5A2A, alpha: 0.75 })
    }

    // Arcane rune circle at base
    g.circle(bottomX, bottomY, 18); g.stroke({ color: 0x6644AA, width: 1, alpha: 0.40 })

    // Project name label
    const lbl = this.makeLabel(this.cfg.name)
    lbl.x = (leftX + bottomX) / 2
    lbl.y = leftY - wallH * 0.45

    this.addChild(g)
    this.addChild(lbl)
  }

  // ── Castle (3×3) ─────────────────────────────────────────────────────────────

  private drawCastle(
    topX: number, topY: number,
    rightX: number, rightY: number,
    bottomX: number, bottomY: number,
    leftX: number, leftY: number,
    wallH: number,
  ): void {
    const wallColor = 0xB8A882
    const g = new Graphics()

    // Base
    g.poly([topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY])
    g.fill(0x7A7A78); g.stroke({ color: 0x5A5A58, width: 1 })

    // Left wall
    g.poly([leftX, leftY, bottomX, bottomY, bottomX, bottomY - wallH, leftX, leftY - wallH])
    g.fill(darken(wallColor, 0.60)); g.stroke({ color: darken(wallColor, 0.42), width: 1 })

    // Right wall
    g.poly([rightX, rightY, bottomX, bottomY, bottomX, bottomY - wallH, rightX, rightY - wallH])
    g.fill(darken(wallColor, 0.80)); g.stroke({ color: darken(wallColor, 0.56), width: 1 })

    // Roof
    g.poly([topX, topY - wallH, rightX, rightY - wallH, bottomX, bottomY - wallH, leftX, leftY - wallH])
    g.fill(0x5A5A5A); g.stroke({ color: 0x3A3A3A, width: 1.5 })

    // Battlements on all 4 roof edges
    const battleEdges: [number, number, number, number][] = [
      [topX, topY - wallH, rightX, rightY - wallH],
      [rightX, rightY - wallH, bottomX, bottomY - wallH],
      [bottomX, bottomY - wallH, leftX, leftY - wallH],
      [leftX, leftY - wallH, topX, topY - wallH],
    ]
    for (const [ax, ay, bx, by] of battleEdges) {
      const dx = bx - ax, dy = by - ay
      for (let m = 0; m < 4; m++) {
        const t0 = 0.08 + m * 0.22, t1 = t0 + 0.10
        g.poly([ax + dx * t0, ay + dy * t0, ax + dx * t1, ay + dy * t1,
                ax + dx * t1, ay + dy * t1 - 7, ax + dx * t0, ay + dy * t0 - 7])
        g.fill(0x6A6A68); g.stroke({ color: 0x4A4A48, width: 0.5 })
      }
    }

    // Turrets at left and bottom corners
    for (const [cx, cy] of [[leftX, leftY], [bottomX, bottomY]] as [number, number][]) {
      g.poly([cx - 8, cy - wallH, cx + 8, cy - wallH, cx + 8, cy - wallH - 14, cx - 8, cy - wallH - 14])
      g.fill(0x6A6A68); g.stroke({ color: 0x4A4A48, width: 1 })
      g.rect(cx - 2, cy - wallH - 10, 5, 6); g.fill({ color: 0xFFAA44, alpha: 0.65 })
    }

    // Grand gatehouse portcullis entrance
    const [g1x, g1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.33, 0.22)
    const [g2x, g2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.67, 0.22)
    const [g3x, g3y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.67, 1.00)
    const [g4x, g4y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.33, 1.00)
    g.poly([g1x, g1y, g2x, g2y, g3x, g3y, g4x, g4y]); g.fill(0x2A2218)
    g.circle((g1x + g2x) / 2, (g1y + g2y) / 2 - 6, 7); g.fill(0x2A2218)
    for (let b = 0; b < 3; b++) {
      const t = 0.37 + b * 0.10
      const [bx1, by1] = wallPt(leftX, leftY, bottomX, bottomY, wallH, t, 0.28)
      const [bx2, by2] = wallPt(leftX, leftY, bottomX, bottomY, wallH, t, 1.00)
      g.moveTo(bx1, by1); g.lineTo(bx2, by2); g.stroke({ color: 0x888888, width: 1 })
    }

    // Right wall narrow windows with warm glow
    for (let i = 0; i < 2; i++) {
      const u0 = 0.22 + i * 0.42
      const [wx1, wy1] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u0,       0.18)
      const [wx2, wy2] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u0 + 0.12, 0.18)
      const [wx3, wy3] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u0 + 0.12, 0.68)
      const [wx4, wy4] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u0,        0.68)
      g.poly([wx1, wy1, wx2, wy2, wx3, wy3, wx4, wy4]); g.fill({ color: 0xFFAA44, alpha: 0.55 })
    }

    // Banner at left turret peak
    const bannerX = leftX
    const bannerY = leftY - wallH - 16
    g.rect(bannerX - 14, bannerY, 28, 12); g.fill(0x8B2020); g.stroke({ color: 0xD4A844, width: 1 })

    // Project name label
    const lbl = this.makeLabel(this.cfg.name)
    lbl.x = (leftX + bottomX) / 2
    lbl.y = leftY - wallH * 0.42

    this.addChild(g)
    this.addChild(lbl)
  }

  private makeLabel(text: string): Text {
    const style = new TextStyle({
      fontFamily: 'monospace', fontSize: 9, fontWeight: 'bold',
      fill: 0xFFFF00, stroke: { color: 0x000000, width: 2 },
    })
    const lbl = new Text({ text, style })
    lbl.anchor.set(0.5, 1)
    return lbl
  }
}
