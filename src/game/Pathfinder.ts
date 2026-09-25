import { GRID, GRID_SIZE } from './IsometricMap'

// ── Binary min-heap ────────────────────────────────────────────────────────────
// Stores [fScore, tx, ty] entries; pops the entry with the lowest fScore first.

class MinHeap {
  private data: [number, number, number][] = []

  get size(): number { return this.data.length }

  push(f: number, tx: number, ty: number): void {
    this.data.push([f, tx, ty])
    this.bubbleUp(this.data.length - 1)
  }

  pop(): [number, number, number] | undefined {
    if (this.data.length === 0) return undefined
    const top  = this.data[0]
    const last = this.data.pop()!
    if (this.data.length > 0) {
      this.data[0] = last
      this.sinkDown(0)
    }
    return top
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.data[parent][0] <= this.data[i][0]) break
      ;[this.data[parent], this.data[i]] = [this.data[i], this.data[parent]]
      i = parent
    }
  }

  private sinkDown(i: number): void {
    const n = this.data.length
    while (true) {
      let smallest = i
      const l = 2 * i + 1
      const r = 2 * i + 2
      if (l < n && this.data[l][0] < this.data[smallest][0]) smallest = l
      if (r < n && this.data[r][0] < this.data[smallest][0]) smallest = r
      if (smallest === i) break
      ;[this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]]
      i = smallest
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function heuristic(tx: number, ty: number, gx: number, gy: number): number {
  return Math.abs(tx - gx) + Math.abs(ty - gy)   // Manhattan distance
}

function nodeKey(tx: number, ty: number): number {
  return ty * GRID_SIZE + tx
}

// ── A* ────────────────────────────────────────────────────────────────────────

/**
 * Finds a path from (startTx, startTy) to (goalTx, goalTy) using A* with a
 * Manhattan-distance heuristic and 4-directional movement.
 *
 * Walkable tiles: GRID value 0 (grass) or 1 (path).
 * Non-walkable:   GRID value 9 (building footprint) or 3 (beach/sand).
 * Door tiles are always walkable regardless of GRID value (pass as doorTiles).
 * Soft-obstacle tiles (occupied by other agents) are walkable but cost +5 extra,
 * so the path will prefer to avoid them without hard-blocking.
 *
 * Returns an array of [tx, ty] pairs from start (exclusive) to goal (inclusive),
 * or null if no path exists.
 */
export function findPath(
  startTx: number,
  startTy: number,
  goalTx:  number,
  goalTy:  number,
  doorTiles: [number, number][] = [],
  softObstacles: Set<number>    = new Set(),
): [number, number][] | null {
  const doorSet = new Set(doorTiles.map(([x, y]) => nodeKey(x, y)))

  function isWalkable(tx: number, ty: number): boolean {
    if (tx < 0 || tx >= GRID_SIZE || ty < 0 || ty >= GRID_SIZE) return false
    if (doorSet.has(nodeKey(tx, ty))) return true
    const t = GRID[ty][tx]
    return t === 0 || t === 1
  }

  // If the agent is on a non-walkable tile (e.g. building footprint edge after
  // placement), snap the start to the nearest reachable walkable neighbour so
  // that dispatch never silently fails.
  let sx = startTx, sy = startTy
  if (!isWalkable(sx, sy)) {
    const DIRS4: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]]
    let found = false
    outer: for (let r = 1; r <= 4; r++) {
      for (const [dx, dy] of DIRS4) {
        const nx = sx + dx * r, ny = sy + dy * r
        if (isWalkable(nx, ny)) { sx = nx; sy = ny; found = true; break outer }
      }
    }
    if (!found) return null
  }

  const startKey = nodeKey(sx, sy)
  const goalKey  = nodeKey(goalTx, goalTy)

  if (startKey === goalKey) return []

  const openSet  = new MinHeap()
  const gScore   = new Map<number, number>()
  const cameFrom = new Map<number, number>()

  gScore.set(startKey, 0)
  openSet.push(heuristic(sx, sy, goalTx, goalTy), sx, sy)

  // Closed set — avoid re-processing nodes
  const closed = new Set<number>()

  const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]]

  while (openSet.size > 0) {
    const [, cx, cy] = openSet.pop()!
    const ck = nodeKey(cx, cy)

    if (closed.has(ck)) continue
    closed.add(ck)

    if (ck === goalKey) {
      // Reconstruct path (start exclusive, goal inclusive)
      const path: [number, number][] = []
      let k = goalKey
      while (k !== startKey) {
        const ty = Math.floor(k / GRID_SIZE)
        const tx = k % GRID_SIZE
        path.push([tx, ty])
        k = cameFrom.get(k)!
      }
      path.reverse()
      return path
    }

    const g = gScore.get(ck) ?? Infinity

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx
      const ny = cy + dy
      if (!isWalkable(nx, ny)) continue
      const nk = nodeKey(nx, ny)
      if (closed.has(nk)) continue
      const ng = g + 1 + (softObstacles.has(nk) ? 5 : 0)
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng)
        cameFrom.set(nk, ck)
        openSet.push(ng + heuristic(nx, ny, goalTx, goalTy), nx, ny)
      }
    }
  }

  return null   // no path found
}
