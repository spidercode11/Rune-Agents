import { GRID_SIZE, TILE_GRASS, TILE_PATH } from "../constants";

/**
 * The terrain grid. 0 = grass, 1 = path.
 * Buildings mark their tiles as non-walkable separately.
 */
export function createTerrainGrid(): number[][] {
  const grid: number[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(TILE_GRASS)
  );

  // Horizontal center path (row 6)
  const pathTiles: [number, number][] = [
    // Main vertical path (column 6)
    [6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10],
    // Top horizontal path (row 6)
    [3, 6], [4, 6], [5, 6], [7, 6], [8, 6], [9, 6],
    // Bottom horizontal path (row 10)
    [3, 10], [4, 10], [5, 10], [7, 10], [8, 10], [9, 10],
  ];

  for (const [col, row] of pathTiles) {
    if (col < GRID_SIZE && row < GRID_SIZE) {
      grid[row][col] = TILE_PATH;
    }
  }

  return grid;
}

/**
 * Compute the set of non-walkable tiles from building footprints.
 * Each building occupies a 3×3 area centered on its tile position.
 */
export function computeWallTiles(
  buildings: Array<{ tileX: number; tileY: number }>
): Set<string> {
  const walls = new Set<string>();
  for (const b of buildings) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        walls.add(`${b.tileX + dx},${b.tileY + dy}`);
      }
    }
  }
  return walls;
}

/**
 * Check if a tile is within grid bounds.
 */
export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
}
