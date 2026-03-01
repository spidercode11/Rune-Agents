import { Container, Graphics, Text } from "pixi.js";
import type { AgentState } from "../../store/gameStore";

/**
 * Agent visual entity rendered in PixiJS.
 *
 * Phase 1 uses simple geometric shapes as placeholder sprites.
 * Replace with spritesheets in Phase 2.
 *
 * State machine: IDLE → WALKING → WORKING → RETURNING → IDLE
 */
export class AgentEntity {
  public container: Container;
  public screenX: number;
  public screenY: number;
  public state: AgentState = "IDLE";
  public progress: number = 0;

  private bodyGraphics: Graphics;
  private nameLabel: Text;
  private statusLabel: Text;
  private progressBar: Graphics;
  private staffGlow: Graphics;
  private frame: number = 0;

  constructor(
    public id: string,
    public name: string,
    x: number,
    y: number
  ) {
    this.screenX = x;
    this.screenY = y;
    this.container = new Container();
    this.container.x = x;
    this.container.y = y;

    // Body (circle + hat)
    this.bodyGraphics = new Graphics();
    this.container.addChild(this.bodyGraphics);

    // Staff glow (visible when working)
    this.staffGlow = new Graphics();
    this.staffGlow.visible = false;
    this.container.addChild(this.staffGlow);

    // Progress bar (visible when working)
    this.progressBar = new Graphics();
    this.progressBar.visible = false;
    this.container.addChild(this.progressBar);

    // Name label
    this.nameLabel = new Text({
      text: name,
      style: {
        fontFamily: "Courier New",
        fontSize: 9,
        fontWeight: "bold",
        fill: "#FF981F",
        align: "center",
      },
    });
    this.nameLabel.anchor.set(0.5, 0);
    this.nameLabel.y = 10;
    this.container.addChild(this.nameLabel);

    // Status label
    this.statusLabel = new Text({
      text: "💤 Idle",
      style: {
        fontFamily: "Courier New",
        fontSize: 8,
        fill: "#AAAAAA",
        align: "center",
      },
    });
    this.statusLabel.anchor.set(0.5, 0);
    this.statusLabel.y = 22;
    this.container.addChild(this.statusLabel);

    this.drawBody();
  }

  private drawBody(): void {
    const g = this.bodyGraphics;
    g.clear();

    // Shadow ellipse
    g.ellipse(0, 4, 10, 5);
    g.fill("rgba(0,0,0,0.3)");

    // Body circle
    g.circle(0, -8, 8);
    g.fill("#6A0DAD");
    g.stroke({ color: "#9B59B6", width: 1.5 });

    // Wizard hat (triangle)
    g.moveTo(0, -26);
    g.lineTo(-8, -12);
    g.lineTo(8, -12);
    g.closePath();
    g.fill("#4A0E8F");
    g.stroke({ color: "#9B59B6", width: 1 });

    // Staff
    g.moveTo(10, 0);
    g.lineTo(14, -20);
    g.stroke({ color: "#8B4513", width: 2 });
  }

  /**
   * Call every frame in the game loop.
   */
  public update(): void {
    this.frame++;
    const bob =
      Math.sin(this.frame * 0.08) *
      (this.state === "WALKING" || this.state === "RETURNING" ? 3 : 1.5);

    this.container.x = this.screenX;
    this.container.y = this.screenY + bob - 8;

    // Status text
    const stateLabels: Record<AgentState, string> = {
      IDLE: "💤 Idle",
      WALKING: "🚶 Moving",
      WORKING: "⚡ Working",
      RETURNING: "🏠 Returning",
    };
    this.statusLabel.text = stateLabels[this.state];
    this.statusLabel.style.fill =
      this.state === "WORKING"
        ? "#FFD700"
        : this.state === "WALKING"
          ? "#00FF00"
          : "#AAAAAA";

    // Staff glow when working
    this.staffGlow.visible = this.state === "WORKING";
    if (this.state === "WORKING") {
      this.staffGlow.clear();
      const glowSize = 4 + Math.sin(this.frame * 0.15) * 2;
      this.staffGlow.circle(14, -22, glowSize);
      this.staffGlow.fill({
        color: "#FFD700",
        alpha: 0.4 + Math.sin(this.frame * 0.15) * 0.3,
      });
    }

    // Progress bar
    this.progressBar.visible = this.state === "WORKING" && this.progress >= 0;
    if (this.progressBar.visible) {
      this.progressBar.clear();
      const pw = 40;
      const ph = 5;
      const py = -34;
      // Background
      this.progressBar.rect(-pw / 2, py, pw, ph);
      this.progressBar.fill("#333333");
      // Fill
      this.progressBar.rect(-pw / 2, py, pw * this.progress, ph);
      this.progressBar.fill("#FFD700");
      // Border
      this.progressBar.rect(-pw / 2, py, pw, ph);
      this.progressBar.stroke({ color: "#555555", width: 1 });
    }
  }

  /**
   * Move the agent's screen position toward a target.
   * Returns true if the agent has arrived.
   */
  public moveToward(targetX: number, targetY: number, speed: number): boolean {
    const dx = targetX - this.screenX;
    const dy = targetY - this.screenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < speed) {
      this.screenX = targetX;
      this.screenY = targetY;
      return true;
    }

    this.screenX += (dx / dist) * speed;
    this.screenY += (dy / dist) * speed;
    return false;
  }
}
