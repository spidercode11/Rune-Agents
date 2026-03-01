import { Graphics } from "pixi.js";
import { TILE_W, TILE_H, GRID_SIZE, TILE_PATH, COLORS } from "../constants";
import { toScreen } from "../map";

/**
 * Draws an isometric diamond tile.
 */
function drawDiamond(
  g: Graphics,
  cx: number,
  cy: number,
  w: number,
  h: number,
  fillColor: string,
  strokeColor?: string
): void {
  g.moveTo(cx, cy - h / 2);
  g.lineTo(cx + w / 2, cy);
  g.lineTo(cx, cy + h / 2);
  g.lineTo(cx - w / 2, cy);
  g.closePath();
  g.fill(fillColor);
  if (strokeColor) {
    g.stroke({ color: strokeColor, width: 1 });
  }
}

/**
 * Creates the static tile grid as a single PixiJS Graphics object.
 * Call this once at startup — the grid doesn't change.
 */
export function createTileGrid(
  terrain: number[][],
  offsetX: number,
  offsetY: number
): Graphics {
  const g = new Graphics();

  for (let ty = 0; ty < GRID_SIZE; ty++) {
    for (let tx = 0; tx < GRID_SIZE; tx++) {
      const { x, y } = toScreen(tx, ty, offsetX, offsetY);
      const isPath = terrain[ty]?.[tx] === TILE_PATH;

      const fill = isPath
        ? COLORS.path
        : (tx + ty) % 2 === 0
          ? COLORS.grassLight
          : COLORS.grassDark;

      const stroke = isPath ? COLORS.pathBorder + "33" : "#1B3B1533";

      drawDiamond(g, x, y, TILE_W - 1, TILE_H - 1, fill, stroke);
    }
  }

  return g;
}

/**
 * Draws a hover highlight on a specific tile.
 */
export function createTileHighlight(): Graphics {
  const g = new Graphics();
  return g;
}

export function updateTileHighlight(
  g: Graphics,
  tileX: number,
  tileY: number,
  offsetX: number,
  offsetY: number
): void {
  g.clear();
  const { x, y } = toScreen(tileX, tileY, offsetX, offsetY);
  drawDiamond(g, x, y, TILE_W - 2, TILE_H - 2, COLORS.hover);
}
