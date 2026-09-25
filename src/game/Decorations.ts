import { Container, Graphics, Assets, Sprite, Texture } from 'pixi.js'
import { toScreen, TILE_H, GRID } from './IsometricMap'

// Minimal building box info needed to compute forbidden zones
interface BuildingBox {
  ox: number; oy: number
  fw: number; fh: number
}

// ── Rock sprites (Rock Pack by Captainskeleto) ─────────────────────────────

const ROCK_DIR = '/assets/tiles/Rock Pack by Captainskeleto/Rocks'
// Plain gray boulders — used for the ordinary scattered rocks.
const ROCK_VARIANTS_PLAIN  = ['Rock1.png', 'Rock2.png', 'Rock4.png', 'Rock6.png', 'Rock10.png', 'Rock20.png']
// Moss-covered rocks — stand in for the old bush shapes.
const ROCK_VARIANTS_GRASSY = ['Rock3.png', 'Rock5.png', 'Rock15.png', 'Rock36.png']

const rockTexturePromises = new Map<string, Promise<Texture[]>>()

function loadRockTextures(variants: string[]): Promise<Texture[]> {
  const key = variants.join(',')
  let promise = rockTexturePromises.get(key)
  if (!promise) {
    promise = Promise.all(
      variants.map((name) => Assets.load<Texture>(encodeURI(`${ROCK_DIR}/${name}`))),
    ).then((textures) => {
      for (const t of textures) t.source.scaleMode = 'nearest'
      return textures
    })
    rockTexturePromises.set(key, promise)
  }
  return promise
}

function placeRock(ctr: Container, x: number, y: number, textures: Texture[]): void {
  const texture = textures[Math.floor(Math.random() * textures.length)]
  const sprite  = new Sprite(texture)
  const scale   = 0.7 + Math.random() * 0.25
  sprite.anchor.set(0.5, 0.82)
  sprite.width  = 32 * scale
  sprite.height = 32 * scale
  sprite.x      = x
  sprite.y      = y
  if (Math.random() < 0.5) sprite.scale.x *= -1   // mirror for natural variety
  ctr.addChild(sprite)
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Returns a Set of "tx,ty" strings for all tiles within `buffer` tiles of any building.
 */
function forbiddenSet(buildings: BuildingBox[], buffer: number): Set<string> {
  const s = new Set<string>()
  for (const { ox, oy, fw, fh } of buildings) {
    for (let ty = oy - buffer; ty <= oy + fh - 1 + buffer; ty++) {
      for (let tx = ox - buffer; tx <= ox + fw - 1 + buffer; tx++) {
        s.add(`${tx},${ty}`)
      }
    }
  }
  return s
}

function safe(tx: number, ty: number, forbidden: Set<string>): boolean {
  return !forbidden.has(`${tx},${ty}`)
}

/**
 * Builds all decorative elements for the 36×36 village grid.
 * Pass building boxes so decorations never overlap building footprints.
 */
export async function buildDecorations(
  offsetX: number,
  offsetY: number,
  buildings: BuildingBox[],
): Promise<Container> {
  const ctr = new Container()
  ctr.eventMode = 'none'

  // 2-tile clearance around all building footprints
  const forbidden = forbiddenSet(buildings, 2)

  // ── Trees ─────────────────────────────────────────────────────────────────
  const treeCandidates: [number, number][] = [
    // NW quadrant (Forge at (4,4)-(6,6))
    [3, 12], [3, 13], [12, 3], [4, 13],
    // NE quadrant (Tavern at (27,4)-(29,6))
    [32, 12], [32, 13], [24, 3], [33, 13],
    // SW quadrant (Library at (4,27)-(6,29))
    [3, 23], [3, 24], [12, 33], [4, 24],
    // SE quadrant (Tower at (27,27)-(29,29))
    [32, 23], [32, 24], [24, 33], [33, 24],
    // Mid-grid flanking the plaza
    [12, 17], [12, 18], [24, 17], [24, 18],
  ]

  for (const [tx, ty] of treeCandidates) {
    if (!safe(tx, ty, forbidden)) continue
    const { x, y } = toScreen(tx, ty, offsetX, offsetY)
    const tall = (tx + ty) % 3 === 0
    ctr.addChild(drawTree(x, y + TILE_H / 2, tall))
  }

  // ── Bushes (grassy/moss-covered rocks, Rock Pack by Captainskeleto) ────────
  const bushCandidates: [number, number][] = [
    [11, 12], [13, 11], [12, 23], [13, 24],
    [24, 12], [23, 11], [24, 23], [23, 24],
    [15,  5], [16,  5], [15, 31], [16, 31],
  ]

  const grassyRockTextures = await loadRockTextures(ROCK_VARIANTS_GRASSY)
  for (const [tx, ty] of bushCandidates) {
    if (GRID[ty][tx] !== 0) continue
    if (!safe(tx, ty, forbidden)) continue
    const { x, y } = toScreen(tx, ty, offsetX, offsetY)
    placeRock(ctr, x, y + TILE_H / 2, grassyRockTextures)
  }

  // ── Rocks (Rock Pack by Captainskeleto) ─────────────────────────────────────
  // GRID===0 guarantees the tile is plain open grass — never a building
  // footprint (9), a trail/path tile (1), or beach (3) — so rocks can never
  // land on top of a building or a path. A minimum spacing check on top of
  // the building buffer keeps the handful of rocks naturally spread out
  // instead of clustered.
  const rockCandidates: [number, number][] = [
    [9, 9], [10, 20], [8, 30], [20, 9], [30, 10], [30, 20], [20, 30],
    [12, 6], [6, 12], [29, 12], [23, 6], [9, 24], [24, 29], [6, 23],
    [14, 9], [22, 26], [26, 22], [9, 14], [17, 9], [17, 29],
  ]
  const ROCK_MIN_SPACING = 5
  const ROCK_MAX_COUNT   = 9

  const plainRockTextures = await loadRockTextures(ROCK_VARIANTS_PLAIN)
  const chosenRocks: [number, number][] = []
  for (const [tx, ty] of shuffle(rockCandidates)) {
    if (chosenRocks.length >= ROCK_MAX_COUNT) break
    if (GRID[ty][tx] !== 0) continue
    if (!safe(tx, ty, forbidden)) continue
    const tooClose = chosenRocks.some(
      ([ox, oy]) => Math.abs(ox - tx) + Math.abs(oy - ty) < ROCK_MIN_SPACING,
    )
    if (tooClose) continue
    chosenRocks.push([tx, ty])
  }

  for (const [tx, ty] of chosenRocks) {
    const { x, y } = toScreen(tx, ty, offsetX, offsetY)
    placeRock(ctr, x, y + TILE_H / 2, plainRockTextures)
  }

  // ── Flower patches ────────────────────────────────────────────────────────
  const flowerCandidates: [number, number][] = [
    [10, 15], [10, 21], [27, 15], [27, 21],
  ]

  for (const [tx, ty] of flowerCandidates) {
    if (!safe(tx, ty, forbidden)) continue
    const { x, y } = toScreen(tx, ty, offsetX, offsetY)
    ctr.addChild(drawFlowerPatch(x, y + TILE_H / 2))
  }


  return ctr
}

// ── Primitive drawing helpers ──────────────────────────────────────────────

function drawTree(x: number, y: number, tall: boolean): Graphics {
  const g = new Graphics()
  g.ellipse(x, y, 9, 4)
  g.fill({ color: 0x000000, alpha: 0.20 })
  g.rect(x - 2, y - 12, 5, 12)
  g.fill(0x5C3317)
  if (tall) {
    g.poly([x, y - 36, x - 8, y - 14, x + 8, y - 14]); g.fill(0x2D5016)
    g.poly([x, y - 44, x - 6, y - 26, x + 6, y - 26]); g.fill(0x3A6820)
  } else {
    g.circle(x, y - 22, 11); g.fill(0x2D5016)
    g.circle(x, y - 28, 9);  g.fill(0x3A6820)
    g.circle(x - 2, y - 32, 6); g.fill(0x4A8028)
  }
  return g
}

function drawFlowerPatch(x: number, y: number): Graphics {
  const g = new Graphics()
  g.ellipse(x, y, 10, 5); g.fill(0x6A5038)
  const flowers: [number, number, number][] = [
    [x - 5, y - 4, 0xCC3333],
    [x,     y - 6, 0xCCCC33],
    [x + 5, y - 4, 0x8833CC],
    [x - 2, y - 8, 0xFF7755],
  ]
  for (const [fx, fy, col] of flowers) {
    g.circle(fx, fy, 2); g.fill(col)
    g.circle(fx, fy, 1); g.fill(0xFFFF88)
  }
  return g
}
