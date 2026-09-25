import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js'
import { toScreen, TILE_W, TILE_H } from './IsometricMap'

// ─── Config ───────────────────────────────────────────────────────────────────

export interface BuildingConfig {
  id:               string
  name:             string
  gridOrigin:       [number, number]   // top-left tile
  footprint:        [number, number]   // [width, height] in tiles
  doorTile:         [number, number]
  roofColor:        number
  wallColor:        number
  trimColor:        number             // window frames, door trim
  chimneyEnabled:   boolean
  signText:         string
  wallHeight?:      number             // override default wall height
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function darken(color: number, f: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xFF) * f))
  const g = Math.min(255, Math.floor(((color >> 8)  & 0xFF) * f))
  const b = Math.min(255, Math.floor((color         & 0xFF) * f))
  return (r << 16) | (g << 8) | b
}

/**
 * Returns a point on a wall face at normalised (u, v) where:
 *   u = 0..1 horizontal across the wall (cornerA → cornerB)
 *   v = 0..1 vertical from top to bottom of wall
 */
function wallPt(
  ax: number, ay: number,
  bx: number, by: number,
  wallH: number,
  u: number, v: number,
): [number, number] {
  return [
    ax + (bx - ax) * u,
    ay + (by - ay) * u - wallH * (1 - v),
  ]
}

// ─── Building class ───────────────────────────────────────────────────────────

const DEFAULT_WALL_H = 40

export class Building extends Container {
  private details  = new Container()
  private fxLayer  = new Container()
  private hoverGfx = new Graphics()
  private ttipCtr  = new Container()

  /**
   * Tile row (max ty) of the footprint's south edge — used for depth sorting
   * against agents. An agent standing on this row or south of it renders in
   * front of the building; north of it, it renders behind. Matched against
   * Agent.depthRow, which tracks the same tile-row basis.
   */
  depthRow = 0

  constructor(readonly cfg: BuildingConfig) {
    super()
  }

  footprintTiles(): Array<{ tx: number; ty: number }> {
    const out: Array<{ tx: number; ty: number }> = []
    const [ox, oy] = this.cfg.gridOrigin
    const [fw, fh] = this.cfg.footprint
    for (let ty = oy; ty < oy + fh; ty++)
      for (let tx = ox; tx < ox + fw; tx++)
        out.push({ tx, ty })
    return out
  }

  init(offsetX: number, offsetY: number, tooltipLayer: Container, spriteTexture?: Texture): void {
    const { wallColor, roofColor, trimColor, name, chimneyEnabled, wallHeight } = this.cfg
    const wallH = wallHeight ?? DEFAULT_WALL_H
    const hw    = TILE_W / 2
    const hh    = TILE_H / 2

    const [ox, oy] = this.cfg.gridOrigin
    const [fw, fh] = this.cfg.footprint
    const tx1 = ox, ty1 = oy
    const tx2 = ox + fw - 1, ty2 = oy + fh - 1

    // ── Isometric footprint corners ────────────────────────────────────────
    const tTop    = toScreen(tx1, ty1, offsetX, offsetY)
    const tRight  = toScreen(tx2, ty1, offsetX, offsetY)
    const tBottom = toScreen(tx2, ty2, offsetX, offsetY)
    const tLeft   = toScreen(tx1, ty2, offsetX, offsetY)

    const topX    = tTop.x
    const topY    = tTop.y
    const rightX  = tRight.x  + hw
    const rightY  = tRight.y  + hh
    const bottomX = tBottom.x
    const bottomY = tBottom.y + TILE_H
    const leftX   = tLeft.x   - hw
    const leftY   = tLeft.y   + hh

    this.depthRow = ty2

    if (spriteTexture) {
      // ── Sprite-based rendering ──────────────────────────────────────────
      // Scale uniformly so the sprite width = footprint diamond width.
      // Anchor at center-bottom so the sprite sits on the footprint's bottom tip.
      spriteTexture.source.scaleMode = 'nearest'
      // Scale uniformly (no squish) — slightly wider than the footprint diamond
      const sprSize = (rightX - leftX) * 1.25   // proportional square, 25% bigger
      const sprite = new Sprite(spriteTexture)
      sprite.anchor.set(0.5, 0.5)               // anchor at centre
      sprite.x      = (leftX + rightX) / 2 - 10 // nudged left
      sprite.y      = (topY  + bottomY) / 2 - 50 // nudged down
      sprite.width  = sprSize
      sprite.height = sprSize
      this.addChild(sprite)

      // Hover: base footprint diamond
      this.hoverGfx.poly([topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY])
      this.hoverGfx.stroke({ color: 0xFFD700, width: 3 })
      this.hoverGfx.visible = false
      this.addChild(this.hoverGfx)

      // Hit polygon covers the full sprite area
      const hit = new Graphics()
      hit.poly([
        leftX,    topY - wallH,
        rightX,   topY - wallH,
        rightX,   rightY,
        bottomX,  bottomY,
        leftX,    leftY,
        leftX,    topY - wallH,
      ])
      hit.fill({ color: 0x000000, alpha: 0.001 })
      hit.eventMode = 'static'
      hit.cursor    = 'pointer'
      this.addChild(hit)

      this.buildTooltip(name, topX, topY - wallH - 10, tooltipLayer)

      hit.on('pointerover', () => { this.hoverGfx.visible = true;  this.ttipCtr.visible = true  })
      hit.on('pointerout',  () => { this.hoverGfx.visible = false; this.ttipCtr.visible = false })
      hit.on('pointerdown', () => console.log(`Building clicked: ${this.cfg.id}`))
      return
    } else {
      // ── Geometry-based rendering ────────────────────────────────────────
      const gfx = new Graphics()

      // Base platform
      const baseColor = this.baseColor()
      gfx.poly([topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY])
      gfx.fill(baseColor)
      gfx.stroke({ color: darken(baseColor, 0.6), width: 1 })

      // Left wall (shadow / south-west face)
      const leftWallCol = darken(wallColor, 0.60)
      gfx.poly([leftX, leftY, bottomX, bottomY, bottomX, bottomY - wallH, leftX, leftY - wallH])
      gfx.fill(leftWallCol)
      gfx.stroke({ color: darken(wallColor, 0.42), width: 1 })

      // Right wall (lit / south-east face)
      const rightWallCol = darken(wallColor, 0.82)
      gfx.poly([rightX, rightY, bottomX, bottomY, bottomX, bottomY - wallH, rightX, rightY - wallH])
      gfx.fill(rightWallCol)
      gfx.stroke({ color: darken(wallColor, 0.58), width: 1 })

      // Roof
      gfx.poly([topX, topY - wallH, rightX, rightY - wallH, bottomX, bottomY - wallH, leftX, leftY - wallH])
      gfx.fill(roofColor)
      gfx.stroke({ color: darken(roofColor, 0.60), width: 1.5 })

      this.addChild(gfx)

      // Per-building architectural details
      this.addBuildingDetails(
        topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY,
        wallH, wallColor, roofColor, trimColor,
      )

      // Chimney (Forge, Tavern)
      if (chimneyEnabled) {
        this.drawChimney(topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY, wallH, wallColor)
      }

      this.addChild(this.details)
    }

    // ── Geometry-path shared code ─────────────────────────────────────────
    this.fxLayer.visible = false
    this.addChild(this.fxLayer)

    // ── Hover glow outline (always shown on hover) ─────────────────────────
    this.hoverGfx.poly([topX, topY - wallH, rightX, rightY - wallH, bottomX, bottomY - wallH, leftX, leftY - wallH])
    this.hoverGfx.stroke({ color: 0xFFD700, width: 3 })
    this.hoverGfx.visible = false
    this.addChild(this.hoverGfx)

    // ── Transparent hit polygon ────────────────────────────────────────────
    const hit = new Graphics()
    hit.poly([
      topX,    topY    - wallH,
      rightX,  rightY  - wallH,
      rightX,  rightY,
      bottomX, bottomY,
      leftX,   leftY,
      leftX,   leftY   - wallH,
    ])
    hit.fill({ color: 0x000000, alpha: 0.001 })
    hit.eventMode = 'static'
    hit.cursor    = 'pointer'
    this.addChild(hit)

    // ── Tooltip ────────────────────────────────────────────────────────────
    this.buildTooltip(name, topX, topY - wallH - 10, tooltipLayer)

    // ── Events ─────────────────────────────────────────────────────────────
    hit.on('pointerover', () => {
      this.hoverGfx.visible = true
      this.ttipCtr.visible  = true
    })
    hit.on('pointerout', () => {
      this.hoverGfx.visible = false
      this.ttipCtr.visible  = false
    })
    hit.on('pointerdown', () => console.log(`Building clicked: ${this.cfg.id}`))
  }

  /** Toggle particle / glow effects — called when agent is assigned to this building. */
  setActive(active: boolean): void {
    this.fxLayer.visible = active
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private baseColor(): number {
    switch (this.cfg.id) {
      case 'town_hall': return 0x9A9088   // light ashlar stone
      case 'forge':     return 0x4A3A2A   // dark weathered stone
      case 'library':   return 0xA89878   // warm sandstone
      case 'tower':     return 0x484458   // dark slate
      case 'tavern':    return 0x8A7355   // warm earth
      case 'cottage':   return 0x8A7A5A   // pale plaster
      default:          return 0x888888
    }
  }

  private addBuildingDetails(
    topX: number, topY: number,
    rightX: number, rightY: number,
    bottomX: number, bottomY: number,
    leftX: number, leftY: number,
    wallH: number,
    _wallColor: number, roofColor: number, trimColor: number,
  ): void {
    const d = this.details

    switch (this.cfg.id) {
      case 'town_hall':
        this.drawTownHallDetails(d, topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY, wallH, trimColor)
        break
      case 'forge':
        this.drawForgeDetails(d, topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY, wallH, trimColor)
        break
      case 'library':
        this.drawLibraryDetails(d, topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY, wallH, trimColor)
        break
      case 'tower':
        this.drawTowerDetails(d, topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY, wallH, roofColor, trimColor)
        break
      case 'tavern':
        this.drawTavernDetails(d, topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY, wallH, trimColor)
        break
      case 'cottage':
        this.drawCottageDetails(d, topX, topY, rightX, rightY, bottomX, bottomY, leftX, leftY, wallH, trimColor)
        break
    }
  }

  // ── Town Hall ──────────────────────────────────────────────────────────────

  private drawTownHallDetails(
    layer: Container,
    topX: number, topY: number,
    rightX: number, rightY: number,
    bottomX: number, bottomY: number,
    leftX: number, leftY: number,
    wallH: number, trimColor: number,
  ): void {
    const g = new Graphics()

    // Gold ridge line across the roof top edge
    g.moveTo(topX, topY - wallH)
    g.lineTo(rightX, rightY - wallH)
    g.stroke({ color: trimColor, width: 2.5 })
    g.moveTo(topX, topY - wallH)
    g.lineTo(leftX, leftY - wallH)
    g.stroke({ color: trimColor, width: 2.5 })

    // Left wall — arched doorway recess (front entrance)
    const [d1x, d1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.35, 0.3)
    const [d2x, d2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.65, 0.3)
    const [d3x, d3y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.65, 1.0)
    const [d4x, d4y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.35, 1.0)
    g.poly([d1x, d1y, d2x, d2y, d3x, d3y, d4x, d4y])
    g.fill(0x3B2E1E)   // dark door recess

    // Arch apex (rounded top to the door)
    const archMidX = (d1x + d2x) / 2
    const archMidY = (d1y + d2y) / 2 - 5
    g.circle(archMidX, archMidY, 5)
    g.fill(0x3B2E1E)

    // Torch brackets (small orange dots flanking the door)
    const [t1x, t1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.28, 0.4)
    const [t2x, t2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.72, 0.4)
    g.circle(t1x, t1y, 3); g.fill(0xFF8C00)
    g.circle(t1x, t1y - 1, 2); g.fill(0xFFD700)
    g.circle(t2x, t2y, 3); g.fill(0xFF8C00)
    g.circle(t2x, t2y - 1, 2); g.fill(0xFFD700)

    // Right wall — three stained glass windows
    for (let i = 0; i < 3; i++) {
      const u = 0.2 + i * 0.26
      const [wx1, wy1] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u,        0.25)
      const [wx2, wy2] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u + 0.14, 0.25)
      const [wx3, wy3] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u + 0.14, 0.80)
      const [wx4, wy4] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u,        0.80)
      const glassCol = i % 2 === 0 ? 0x4A6FA5 : 0x8B4A2E
      g.poly([wx1, wy1, wx2, wy2, wx3, wy3, wx4, wy4])
      g.fill(glassCol)
    }

    // Flag at roof peak
    g.poly([topX, topY - wallH - 2, topX + 8, topY - wallH - 8, topX, topY - wallH - 14])
    g.fill(0xFFD700)

    // Two stone pillars at front entrance base
    const [p1x, p1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.32, 0.6)
    const [p2x, p2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.68, 0.6)
    g.rect(p1x - 1, p1y, 3, wallH * 0.6)
    g.fill(0xB0A898)
    g.rect(p2x - 1, p2y, 3, wallH * 0.6)
    g.fill(0xB0A898)

    // ── Battlements (crenellations) along all 4 roof perimeter edges ───────
    const battleH = 7
    const merlonCol = darken(trimColor, 0.80)
    const roofEdges: [number, number, number, number][] = [
      [topX, topY - wallH, rightX, rightY - wallH],
      [rightX, rightY - wallH, bottomX, bottomY - wallH],
      [bottomX, bottomY - wallH, leftX, leftY - wallH],
      [leftX, leftY - wallH, topX, topY - wallH],
    ]
    for (const [ax, ay, bx, by] of roofEdges) {
      const dx = bx - ax; const dy = by - ay
      for (let m = 0; m < 3; m++) {
        const t0 = 0.15 + m * 0.28
        const t1 = t0 + 0.13
        const x0 = ax + dx * t0; const y0 = ay + dy * t0
        const x1 = ax + dx * t1; const y1 = ay + dy * t1
        g.poly([x0, y0, x1, y1, x1, y1 - battleH, x0, y0 - battleH])
        g.fill(merlonCol)
        g.stroke({ color: darken(merlonCol, 0.70), width: 0.5 })
      }
    }

    layer.addChild(g)
  }

  // ── Forge ──────────────────────────────────────────────────────────────────

  private drawForgeDetails(
    layer: Container,
    _topX: number, _topY: number,
    rightX: number, rightY: number,
    bottomX: number, bottomY: number,
    leftX: number, leftY: number,
    wallH: number, _trimColor: number,
  ): void {
    const g = new Graphics()

    // Front (left) wall — wide forge window with orange glow
    const [fw1x, fw1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.25, 0.28)
    const [fw2x, fw2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.75, 0.28)
    const [fw3x, fw3y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.75, 0.72)
    const [fw4x, fw4y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.25, 0.72)
    // Glow halo
    g.poly([fw1x - 2, fw1y - 2, fw2x + 2, fw2y - 2, fw3x + 2, fw3y + 2, fw4x - 2, fw4y + 2])
    g.fill({ color: 0xFF6600, alpha: 0.35 })
    // Window
    g.poly([fw1x, fw1y, fw2x, fw2y, fw3x, fw3y, fw4x, fw4y])
    g.fill(0xE8822A)

    // Forge glow core
    const gCx = (fw1x + fw2x + fw3x + fw4x) / 4
    const gCy = (fw1y + fw2y + fw3y + fw4y) / 4
    g.circle(gCx, gCy, 4)
    g.fill(0xFFCC44)

    // Side (right) wall — iron bracket reinforcements at corners
    const [sb1x, sb1y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.12, 0.1)
    const [sb2x, sb2y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.88, 0.1)
    g.rect(sb1x - 1, sb1y, 4, 6); g.fill(0x7A7A7A)
    g.rect(sb2x - 1, sb2y, 4, 6); g.fill(0x7A7A7A)

    // Small shuttered side window
    const [sw1x, sw1y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.35, 0.3)
    const [sw2x, sw2y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.65, 0.3)
    const [sw3x, sw3y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.65, 0.7)
    const [sw4x, sw4y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.35, 0.7)
    g.poly([sw1x, sw1y, sw2x, sw2y, sw3x, sw3y, sw4x, sw4y])
    g.fill(0x3A2810)

    // Anvil shape in front of door (small dark iron shape)
    const anvX = bottomX - 8
    const anvY = bottomY - 4
    g.rect(anvX, anvY, 8, 3); g.fill(0x3A3A3A)
    g.rect(anvX + 2, anvY + 3, 4, 3); g.fill(0x5C3A1E) // stump

    // Barrel beside door
    const barX = bottomX + 4
    const barY = bottomY - 5
    g.rect(barX, barY, 5, 6); g.fill(0x6B4A2E)
    g.moveTo(barX, barY + 2); g.lineTo(barX + 5, barY + 2)
    g.stroke({ color: 0x3A2A1E, width: 1 })

    layer.addChild(g)
  }

  // ── Library ────────────────────────────────────────────────────────────────

  private drawLibraryDetails(
    layer: Container,
    _topX: number, _topY: number,
    rightX: number, rightY: number,
    bottomX: number, bottomY: number,
    leftX: number, leftY: number,
    wallH: number, _trimColor: number,
  ): void {
    const g = new Graphics()

    // Front wall — grand arched doorway
    const [d1x, d1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.35, 0.35)
    const [d2x, d2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.65, 0.35)
    const [d3x, d3y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.65, 1.0)
    const [d4x, d4y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.35, 1.0)
    g.poly([d1x, d1y, d2x, d2y, d3x, d3y, d4x, d4y])
    g.fill(0x4A3520)
    g.circle((d1x + d2x) / 2, (d1y + d2y) / 2 - 4, 4)
    g.fill(0x4A3520)

    // Two narrow stained glass windows flanking the door
    for (let i = 0; i < 2; i++) {
      const u = i === 0 ? 0.12 : 0.80
      const [wx1, wy1] = wallPt(leftX, leftY, bottomX, bottomY, wallH, u,        0.2)
      const [wx2, wy2] = wallPt(leftX, leftY, bottomX, bottomY, wallH, u + 0.10, 0.2)
      const [wx3, wy3] = wallPt(leftX, leftY, bottomX, bottomY, wallH, u + 0.10, 0.78)
      const [wx4, wy4] = wallPt(leftX, leftY, bottomX, bottomY, wallH, u,        0.78)
      g.poly([wx1, wy1, wx2, wy2, wx3, wy3, wx4, wy4])
      g.fill(0x4466AA)
      // Colour segments
      g.poly([wx1, wy1, wx2, wy2, wx3, wy3, wx4, wy4])
      g.stroke({ color: 0x8B9900, width: 1 })
    }

    // Side wall — large bookshelf window
    const [bw1x, bw1y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.20, 0.20)
    const [bw2x, bw2y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.80, 0.20)
    const [bw3x, bw3y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.80, 0.78)
    const [bw4x, bw4y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.20, 0.78)
    g.poly([bw1x, bw1y, bw2x, bw2y, bw3x, bw3y, bw4x, bw4y])
    g.fill(0x1A1A2A)

    // Book spine stripes in window
    for (let row = 0; row < 3; row++) {
      const v0 = 0.25 + row * 0.17
      const v1 = v0 + 0.12
      const colors = [0x8B3A2A, 0x4A6B2A, 0x2A3A8B, 0xAA7722]
      for (let col = 0; col < 4; col++) {
        const u0 = 0.22 + col * 0.14
        const [sx1, sy1] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u0, v0)
        const [sx2, sy2] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u0 + 0.11, v0)
        const [sx3, sy3] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u0 + 0.11, v1)
        const [sx4, sy4] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u0, v1)
        g.poly([sx1, sy1, sx2, sy2, sx3, sy3, sx4, sy4])
        g.fill(colors[col % colors.length])
      }
    }

    // Owl weathervane at roof peak (tiny silhouette)
    const owlX = _topX ?? (leftX + rightX) / 2
    const owlY = _topY ?? 0
    const peakX = (leftX + rightX + bottomX) / 3
    const peakY = Math.min(leftY, rightY) - wallH - 4
    g.circle(peakX, peakY, 4); g.fill(0x2A2A30)
    g.poly([peakX - 3, peakY + 1, peakX + 3, peakY + 1, peakX, peakY + 6])
    g.fill(0x2A2A30)

    // Lectern beside door
    const lecX = bottomX - 10
    const lecY = bottomY - 7
    g.poly([lecX, lecY, lecX + 8, lecY - 3, lecX + 8, lecY + 2, lecX, lecY + 5])
    g.fill(0x7A5A2A)
    g.poly([lecX, lecY, lecX + 8, lecY - 3, lecX + 7, lecY - 5, lecX + 1, lecY - 2])
    g.fill(0xF8F0E0)   // open book page

    layer.addChild(g)

    // Suppress unused-var warning
    void owlX; void owlY
  }

  // ── Tower ──────────────────────────────────────────────────────────────────

  private drawTowerDetails(
    layer: Container,
    topX: number, topY: number,
    rightX: number, rightY: number,
    bottomX: number, bottomY: number,
    leftX: number, leftY: number,
    wallH: number, roofColor: number, trimColor: number,
  ): void {
    const g = new Graphics()

    // ── Crenellations at tower top ─────────────────────────────────────────
    const towerEdges: [number, number, number, number][] = [
      [topX, topY - wallH, rightX, rightY - wallH],
      [rightX, rightY - wallH, bottomX, bottomY - wallH],
      [bottomX, bottomY - wallH, leftX, leftY - wallH],
      [leftX, leftY - wallH, topX, topY - wallH],
    ]
    for (const [ax, ay, bx, by] of towerEdges) {
      const dx = bx - ax; const dy = by - ay
      for (let m = 0; m < 4; m++) {
        const t0 = 0.08 + m * 0.23
        const t1 = t0 + 0.11
        const x0 = ax + dx * t0; const y0 = ay + dy * t0
        const x1 = ax + dx * t1; const y1 = ay + dy * t1
        g.poly([x0, y0, x1, y1, x1, y1 - 6, x0, y0 - 6])
        g.fill(0x5A5A6A)
        g.stroke({ color: 0x3A3A4A, width: 0.5 })
      }
    }

    // Conical roof overlay — tall wizard-tower spike
    const coneH  = 42
    const rMidX  = (topX + rightX + bottomX + leftX) / 4
    const rMidY  = (topY + rightY + bottomY + leftY) / 4 - wallH
    g.poly([topX, topY - wallH, rightX, rightY - wallH, bottomX, bottomY - wallH, leftX, leftY - wallH, rMidX, rMidY - coneH])
    g.fill(roofColor)
    g.stroke({ color: trimColor, width: 1.5 })

    // Arcane spiral lines on cone
    g.moveTo(rMidX - 5, rMidY - coneH * 0.25)
    g.lineTo(rMidX + 5, rMidY - coneH * 0.55)
    g.stroke({ color: trimColor, width: 1.5 })
    g.moveTo(rMidX - 3, rMidY - coneH * 0.55)
    g.lineTo(rMidX + 3, rMidY - coneH * 0.80)
    g.stroke({ color: trimColor, width: 1 })

    // Crystal orb at tip
    g.circle(rMidX, rMidY - coneH, 5)
    g.fill(0x66AAFF)
    g.circle(rMidX, rMidY - coneH, 3)
    g.fill(0xCCEEFF)

    // Front wall — iron-banded heavy door
    const [d1x, d1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.35, 0.50)
    const [d2x, d2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.65, 0.50)
    const [d3x, d3y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.65, 1.0)
    const [d4x, d4y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.35, 1.0)
    g.poly([d1x, d1y, d2x, d2y, d3x, d3y, d4x, d4y])
    g.fill(0x3A2A1E)
    // Iron bands
    for (let b = 0; b < 2; b++) {
      const bv = 0.56 + b * 0.20
      const [bx1, by1] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.35, bv)
      const [bx2, by2] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.65, bv)
      g.moveTo(bx1, by1); g.lineTo(bx2, by2)
      g.stroke({ color: 0x888888, width: 1.5 })
    }

    // Front wall — arcane archer slit (middle level)
    const [as1x, as1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.44, 0.15)
    const [as2x, as2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.56, 0.15)
    const [as3x, as3y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.56, 0.42)
    const [as4x, as4y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.44, 0.42)
    g.poly([as1x, as1y, as2x, as2y, as3x, as3y, as4x, as4y])
    g.fill(0x4A7ACC)

    // Side wall — ivy patches (scattered dark green pixels)
    for (let i = 0; i < 8; i++) {
      const u = 0.1 + (i % 4) * 0.22
      const v = 0.3 + Math.floor(i / 4) * 0.35
      const [ix, iy] = wallPt(rightX, rightY, bottomX, bottomY, wallH, u, v)
      g.circle(ix, iy, 2 + (i % 2))
      g.fill({ color: 0x3A5A2A, alpha: 0.75 })
    }

    // Arcane ground runes (faint circle around base)
    g.circle(bottomX, bottomY, 22)
    g.stroke({ color: 0x6644AA, width: 1, alpha: 0.35 })

    // Spiral staircase protrusion on right wall
    for (let s = 0; s < 3; s++) {
      const [sx, sy] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.7, 0.25 + s * 0.22)
      g.rect(sx, sy, 4, 3)
      g.fill(0x4A4A55)
    }

    layer.addChild(g)

    // Effects layer — orb glow pulse (kept visible=false until setActive)
    const eff = new Graphics()
    eff.circle(rMidX, rMidY - coneH, 7)
    eff.fill({ color: 0x66AAFF, alpha: 0.45 })
    this.fxLayer.addChild(eff)
  }

  // ── Tavern ─────────────────────────────────────────────────────────────────

  private drawTavernDetails(
    layer: Container,
    _topX: number, _topY: number,
    rightX: number, rightY: number,
    bottomX: number, bottomY: number,
    leftX: number, leftY: number,
    wallH: number, _trimColor: number,
  ): void {
    const g = new Graphics()

    // Tudor half-timber pattern on left wall — white daub infill between dark beams
    for (let row = 0; row < 2; row++) {
      const v0 = 0.10 + row * 0.40
      const v1 = v0 + 0.32
      const [tx1, ty1] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.05, v0)
      const [tx2, ty2] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.95, v0)
      const [tx3, ty3] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.95, v1)
      const [tx4, ty4] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.05, v1)
      g.poly([tx1, ty1, tx2, ty2, tx3, ty3, tx4, ty4])
      g.fill({ color: 0xD4C8B0, alpha: 0.35 })
    }

    // Front wall — wide welcoming doorway with warm glow
    const [d1x, d1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.30, 0.40)
    const [d2x, d2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.70, 0.40)
    const [d3x, d3y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.70, 1.0)
    const [d4x, d4y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.30, 1.0)
    g.poly([d1x - 1, d1y - 1, d2x + 1, d2y - 1, d3x + 1, d3y, d4x - 1, d4y])
    g.fill({ color: 0xFFB84D, alpha: 0.3 })  // glow halo
    g.poly([d1x, d1y, d2x, d2y, d3x, d3y, d4x, d4y])
    g.fill(0x3A2010)
    // Rounded arch top
    g.circle((d1x + d2x) / 2, (d1y + d2y) / 2 - 3, 4)
    g.fill(0x3A2010)

    // Mullioned window right of door
    const [mw1x, mw1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.75, 0.25)
    const [mw2x, mw2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.95, 0.25)
    const [mw3x, mw3y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.95, 0.72)
    const [mw4x, mw4y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.75, 0.72)
    g.poly([mw1x, mw1y, mw2x, mw2y, mw3x, mw3y, mw4x, mw4y])
    g.fill({ color: 0xFFB84D, alpha: 0.60 })   // warm light

    // Side wall — two small round porthole windows
    for (let i = 0; i < 2; i++) {
      const [cx, cy] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.28 + i * 0.44, 0.40)
      g.circle(cx, cy, 4)
      g.fill({ color: 0xFFB84D, alpha: 0.55 })
      g.circle(cx, cy, 4)
      g.stroke({ color: 0x5C3A1E, width: 1 })
    }

    // Hanging pub sign (small rectangle below roof edge)
    const signX = (leftX + bottomX) / 2 - 6
    const signY = leftY - wallH * 0.55
    g.rect(signX, signY, 14, 8)
    g.fill(0x7A5A2A)
    g.rect(signX, signY, 14, 8)
    g.stroke({ color: 0x4A3010, width: 1 })
    // Foaming mug pixel (simplified)
    g.rect(signX + 3, signY + 2, 5, 5); g.fill(0x8B6040)
    g.rect(signX + 3, signY + 2, 5, 2); g.fill(0xF0F0F0)  // foam

    // Two stacked barrels beside door
    const barX = bottomX + 3
    const barY = bottomY - 8
    g.rect(barX, barY, 6, 4); g.fill(0x6B4A2E)
    g.rect(barX, barY + 5, 6, 4); g.fill(0x6B4A2E)
    g.moveTo(barX, barY + 2); g.lineTo(barX + 6, barY + 2)
    g.stroke({ color: 0x888888, width: 1 })

    // String lights (3 tiny dots under the awning)
    for (let i = 0; i < 3; i++) {
      const lx = d1x + (d2x - d1x) * (0.2 + i * 0.3)
      const ly = d1y + (d2y - d1y) * (0.2 + i * 0.3) - 6
      g.circle(lx, ly, 2); g.fill(0xFFEE88)
    }

    layer.addChild(g)
  }

  // ── Cottage ────────────────────────────────────────────────────────────────

  private drawCottageDetails(
    layer: Container,
    topX: number, topY: number,
    rightX: number, rightY: number,
    bottomX: number, bottomY: number,
    leftX: number, leftY: number,
    wallH: number, _trimColor: number,
  ): void {
    const g = new Graphics()

    // Oversized thatched roof overlay — droops 4px below the wall base line
    const droop = 4
    g.poly([
      topX, topY - wallH - 4,
      rightX, rightY - wallH - 4,
      rightX + droop, rightY + droop,
      bottomX, bottomY + droop,
      leftX + droop, leftY + droop,
      leftX, leftY - wallH - 4,
    ])
    g.fill(0x8B7B40)
    g.stroke({ color: darken(0x8B7B40, 0.70), width: 1 })

    // Round-topped front door
    const [d1x, d1y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.30, 0.45)
    const [d2x, d2y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.70, 0.45)
    const [d3x, d3y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.70, 1.0)
    const [d4x, d4y] = wallPt(leftX, leftY, bottomX, bottomY, wallH, 0.30, 1.0)
    g.poly([d1x, d1y, d2x, d2y, d3x, d3y, d4x, d4y])
    g.fill(0x6B4A2E)
    g.circle((d1x + d2x) / 2, (d1y + d2y) / 2 - 2, 3)
    g.fill(0x6B4A2E)
    // Porthole window in door
    g.circle((d1x + d2x) / 2, (d1y + d2y) / 2 - 2, 3)
    g.stroke({ color: 0xC8A870, width: 1 })

    // Green shuttered window on right wall
    const [sw1x, sw1y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.25, 0.30)
    const [sw2x, sw2y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.75, 0.30)
    const [sw3x, sw3y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.75, 0.72)
    const [sw4x, sw4y] = wallPt(rightX, rightY, bottomX, bottomY, wallH, 0.25, 0.72)
    // Left shutter
    g.poly([sw1x, sw1y, (sw1x+sw2x)/2, (sw1y+sw2y)/2, (sw3x+sw4x)/2, (sw3y+sw4y)/2, sw4x, sw4y])
    g.fill(0x4A7A3A)
    // Right shutter
    g.poly([(sw1x+sw2x)/2, (sw1y+sw2y)/2, sw2x, sw2y, sw3x, sw3y, (sw3x+sw4x)/2, (sw3y+sw4y)/2])
    g.fill(0x4A7A3A)
    // Window glow
    g.poly([sw1x, sw1y, sw2x, sw2y, sw3x, sw3y, sw4x, sw4y])
    g.fill({ color: 0xFFCC66, alpha: 0.25 })

    // Tiny chimney
    const chimX = topX + 4
    const chimY = topY - wallH - 4
    g.rect(chimX - 2, chimY - 6, 5, 6)
    g.fill(0x7A5A3A)

    // Small garden patch on adjacent tile (just outside left corner)
    const gardX = leftX - 8
    const gardY = leftY + 2
    g.rect(gardX, gardY, 14, 7); g.fill(0x6A5A3A)
    // Flowers
    const flowerCols = [0xCC3333, 0xCCCC33, 0x3355CC]
    for (let i = 0; i < 3; i++) {
      g.circle(gardX + 2 + i * 4, gardY + 3, 2)
      g.fill(flowerCols[i])
    }

    // Welcome mat
    const matX = (d4x + d3x) / 2 - 5
    const matY = (d4y + d3y) / 2 + 1
    g.rect(matX, matY, 10, 4); g.fill(0x8B6A3A)

    // Mailbox post
    const mbX = d4x - 10
    const mbY = d4y - 2
    g.rect(mbX, mbY - 6, 1, 6); g.fill(0x888888)
    g.rect(mbX - 2, mbY - 8, 6, 4); g.fill(0xAAAAAA)

    layer.addChild(g)

    // Suppress unused-var warnings
    void topX; void topY; void rightX; void rightY
  }

  // ── Chimney (shared by Forge + Tavern) ────────────────────────────────────

  private drawChimney(
    topX: number, topY: number,
    _rightX: number, _rightY: number,
    _bottomX: number, _bottomY: number,
    leftX: number, _leftY: number,
    wallH: number, wallColor: number,
  ): void {
    const g = new Graphics()
    const brickCol = this.cfg.id === 'forge' ? 0x5A3A2A : 0x7A4A2A
    const chimH    = this.cfg.id === 'forge' ? 18 : 12

    // Position chimney on the back-left of the roof
    const cx = topX + (leftX - topX) * 0.35
    const cy = topY - wallH - 4

    g.rect(cx - 3, cy - chimH, 7, chimH)
    g.fill(brickCol)
    // Brick lines
    for (let b = 0; b < 3; b++) {
      g.moveTo(cx - 3, cy - chimH + b * 5)
      g.lineTo(cx + 4, cy - chimH + b * 5)
      g.stroke({ color: darken(brickCol, 0.70), width: 1 })
    }
    // Cap
    g.rect(cx - 4, cy - chimH - 2, 9, 3)
    g.fill(darken(wallColor, 0.75))

    // Smoke puffs in effects layer
    const eff = new Graphics()
    eff.circle(cx, cy - chimH - 8, 5); eff.fill({ color: 0xCCCCCC, alpha: 0.50 })
    eff.circle(cx + 3, cy - chimH - 15, 4); eff.fill({ color: 0xDDDDDD, alpha: 0.35 })
    this.fxLayer.addChild(eff)

    this.addChild(g)

    void _rightX; void _rightY; void _bottomX; void _bottomY
  }

  // ── Tooltip ────────────────────────────────────────────────────────────────

  private buildTooltip(label: string, cx: number, cy: number, layer: Container): void {
    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize:   12,
      fontWeight: 'bold',
      fill:       0xFFFF00,
    })
    const txt = new Text({ text: label, style })
    txt.anchor.set(0.5, 1)
    txt.x = cx
    txt.y = cy

    const pad = 6
    const bg  = new Graphics()
    bg.rect(cx - txt.width / 2 - pad, cy - txt.height - pad, txt.width + pad * 2, txt.height + pad * 2)
    bg.fill({ color: 0x1A1611, alpha: 0.88 })
    bg.stroke({ color: 0x6B5A45, width: 1 })

    this.ttipCtr.addChild(bg)
    this.ttipCtr.addChild(txt)
    this.ttipCtr.visible = false
    layer.addChild(this.ttipCtr)
  }
}
