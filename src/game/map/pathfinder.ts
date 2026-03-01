import { GRID_SIZE, DIRECTIONS } from "../constants";
import { inBounds } from "./terrainGrid";

interface PathNode {
  x: number;
  y: number;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: PathNode | null;
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * A* pathfinding on the tile grid.
 *
 * @param sx Start tile X
 * @param sy Start tile Y
 * @param ex End tile X
 * @param ey End tile Y
 * @param walls Set of "x,y" strings representing non-walkable tiles
 * @returns Array of {x, y} tile positions from start to end, or null if no path.
 */
export function findPath(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  walls: Set<string>
): Array<{ x: number; y: number }> | null {
  const key = (x: number, y: number) => `${x},${y}`;

  const startH = heuristic(sx, sy, ex, ey);
  const open: PathNode[] = [
    { x: sx, y: sy, g: 0, h: startH, f: startH, parent: null },
  ];
  const closed = new Set<string>();

  while (open.length > 0) {
    // Find node with lowest f
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;

    // Reached the goal
    if (current.x === ex && current.y === ey) {
      const path: Array<{ x: number; y: number }> = [];
      let node: PathNode | null = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closed.add(key(current.x, current.y));

    // Explore neighbors (4-directional)
    for (const [dx, dy] of DIRECTIONS) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (!inBounds(nx, ny)) continue;
      if (closed.has(key(nx, ny))) continue;

      // Allow walking to the goal tile even if it's a wall (door tile)
      if (walls.has(key(nx, ny)) && !(nx === ex && ny === ey)) continue;

      const g = current.g + 1;
      const existing = open.find((n) => n.x === nx && n.y === ny);

      if (existing && g >= existing.g) continue;

      if (existing) {
        existing.g = g;
        existing.f = g + existing.h;
        existing.parent = current;
      } else {
        const h = heuristic(nx, ny, ex, ey);
        open.push({ x: nx, y: ny, g, h, f: g + h, parent: current });
      }
    }
  }

  return null; // No path found
}
