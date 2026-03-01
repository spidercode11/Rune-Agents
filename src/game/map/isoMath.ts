import { TILE_W, TILE_H } from "../constants";

/**
 * Convert tile grid coordinates to screen pixel position.
 * The offset centers the map in the viewport.
 */
export function toScreen(
  tileX: number,
  tileY: number,
  offsetX: number,
  offsetY: number
): { x: number; y: number } {
  return {
    x: (tileX - tileY) * (TILE_W / 2) + offsetX,
    y: (tileX + tileY) * (TILE_H / 2) + offsetY,
  };
}

/**
 * Convert screen pixel position back to tile grid coordinates.
 * Used for mouse click → tile detection.
 */
export function toTile(
  screenX: number,
  screenY: number,
  offsetX: number,
  offsetY: number
): { x: number; y: number } {
  const ax = screenX - offsetX;
  const ay = screenY - offsetY;
  return {
    x: Math.floor((ax / (TILE_W / 2) + ay / (TILE_H / 2)) / 2),
    y: Math.floor((ay / (TILE_H / 2) - ax / (TILE_W / 2)) / 2),
  };
}

/**
 * Linear interpolation between two values.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Distance between two tile positions (Manhattan distance for A*).
 */
export function manhattanDist(
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * Euclidean distance between two screen positions.
 */
export function screenDist(
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
