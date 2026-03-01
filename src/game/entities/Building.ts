import { Container, Graphics, Text } from "pixi.js";
import { TILE_W, TILE_H } from "../constants";
import { toScreen } from "../map";

export interface BuildingConfig {
  id: string;
  name: string;
  emoji: string;
  tileX: number;
  tileY: number;
  color: string;
  roofColor: string;
}

/**
 * Building visual entity rendered in PixiJS.
 * Draws an isometric 3D block with walls and a colored roof.
 */
export class BuildingEntity {
  public container: Container;
  public screenX: number;
  public screenY: number;
  public isHovered: boolean = false;
  public isActive: boolean = false;

  private baseGraphics: Graphics;
  private hoverGraphics: Graphics;
  private label: Text;
  private emojiLabel: Text;

  constructor(
    public config: BuildingConfig,
    offsetX: number,
    offsetY: number
  ) {
    const { x, y } = toScreen(config.tileX, config.tileY, offsetX, offsetY);
    this.screenX = x;
    this.screenY = y;

    this.container = new Container();
    this.container.x = x;
    this.container.y = y;

    // Base building graphics (static)
    this.baseGraphics = new Graphics();
    this.drawBuilding(this.baseGraphics);
    this.container.addChild(this.baseGraphics);

    // Hover/active glow overlay
    this.hoverGraphics = new Graphics();
    this.hoverGraphics.visible = false;
    this.container.addChild(this.hoverGraphics);

    // Emoji on top
    this.emojiLabel = new Text({
      text: config.emoji,
      style: { fontSize: 18 },
    });
    this.emojiLabel.anchor.set(0.5, 0.5);
    this.emojiLabel.y = -WALL_HEIGHT - 8;
    this.container.addChild(this.emojiLabel);

    // Name plate below
    this.label = new Text({
      text: config.name.toUpperCase(),
      style: {
        fontFamily: "Courier New",
        fontSize: 10,
        fontWeight: "bold",
        fill: "#DDDDDD",
        align: "center",
      },
    });
    this.label.anchor.set(0.5, 0);
    this.label.y = TILE_H * 0.8 + 6;
    this.container.addChild(this.label);
  }

  private drawBuilding(g: Graphics): void {
    const bw = TILE_W * 1.6;
    const bh = TILE_H * 1.6;
    const { color, roofColor } = this.config;

    // Shadow
    this.drawDiamond(g, 3, 3, bw, bh, "rgba(0,0,0,0.2)");

    // Base
    this.drawDiamond(g, 0, 0, bw, bh, color + "DD", "#00000066");

    // Left wall
    g.moveTo(-bw / 2, 0);
    g.lineTo(0, bh / 2);
    g.lineTo(0, bh / 2 - WALL_HEIGHT);
    g.lineTo(-bw / 2, -WALL_HEIGHT);
    g.closePath();
    g.fill(color + "AA");
    g.stroke({ color: "#00000033", width: 1 });

    // Right wall
    g.moveTo(bw / 2, 0);
    g.lineTo(0, bh / 2);
    g.lineTo(0, bh / 2 - WALL_HEIGHT);
    g.lineTo(bw / 2, -WALL_HEIGHT);
    g.closePath();
    g.fill(color + "CC");
    g.stroke({ color: "#00000033", width: 1 });

    // Roof
    this.drawDiamond(g, 0, -WALL_HEIGHT, bw + 4, bh + 4, roofColor, "#00000044");
  }

  private drawDiamond(
    g: Graphics,
    cx: number,
    cy: number,
    w: number,
    h: number,
    fill: string,
    stroke?: string
  ): void {
    g.moveTo(cx, cy - h / 2);
    g.lineTo(cx + w / 2, cy);
    g.lineTo(cx, cy + h / 2);
    g.lineTo(cx - w / 2, cy);
    g.closePath();
    g.fill(fill);
    if (stroke) {
      g.stroke({ color: stroke, width: 1 });
    }
  }

  /**
   * Update hover/active visual state.
   */
  public update(): void {
    this.hoverGraphics.visible = this.isHovered || this.isActive;

    if (this.hoverGraphics.visible) {
      this.hoverGraphics.clear();
      const bw = TILE_W * 1.6 + 6;
      const bh = TILE_H * 1.6 + 6;
      const color = this.isActive ? "#FFD70088" : "#FFFFFF44";
      this.drawDiamond(this.hoverGraphics, 0, 0, bw, bh, "transparent", color);
    }

    this.label.style.fill = this.isHovered ? "#FFD700" : "#DDDDDD";
  }

  /**
   * Hit test — is a screen-space point near this building?
   */
  public hitTest(sx: number, sy: number): boolean {
    return Math.abs(sx - this.screenX) < TILE_W && Math.abs(sy - this.screenY) < TILE_H * 1.5;
  }
}

const WALL_HEIGHT = 36;
