import { Graphics } from "pixi.js";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
}

/**
 * Simple particle pool for visual effects.
 * Used for gold sparkles on task completion,
 * and can be extended for other effects later.
 */
export class ParticleSystem {
  private particles: Particle[] = [];
  public graphics: Graphics;

  constructor() {
    this.graphics = new Graphics();
  }

  /**
   * Emit a burst of particles at a screen position.
   */
  public emit(
    x: number,
    y: number,
    count: number = 15,
    color: string = "#FFD700"
  ): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3 - 1,
        life: 1,
        decay: 0.015 + Math.random() * 0.02,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  /**
   * Update and render all particles. Call every frame.
   */
  public update(): void {
    this.graphics.clear();

    this.particles = this.particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06; // gravity
      p.life -= p.decay;

      if (p.life <= 0) return false;

      this.graphics.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      this.graphics.fill({ color: p.color, alpha: p.life });

      return true;
    });
  }
}
