// ─── Grid Constants ───
export const TILE_W = 64;
export const TILE_H = 32;
export const GRID_SIZE = 13;

// ─── Rendering ───
export const AGENT_SPEED = 2.5; // pixels per frame
export const TILE_MOVE_DURATION = 300; // ms per tile of movement

// ─── Tile Types ───
export const TILE_GRASS = 0;
export const TILE_PATH = 1;
export const TILE_WATER = 2;

// ─── Colors ───
export const COLORS = {
  grassLight: "#2D5A27",
  grassDark: "#346B2E",
  path: "#8B7D6B",
  pathBorder: "#6B5D4B",
  hover: "#FFFFFF33",
  homeTile: "#FF981F22",
  homeBorder: "#FF981F66",
} as const;

// ─── Direction Offsets (4-directional movement) ───
export const DIRECTIONS = [
  [0, 1],   // south-east
  [0, -1],  // north-west
  [1, 0],   // south-west
  [-1, 0],  // north-east
] as const;
