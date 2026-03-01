import { useEffect, useRef } from "react";
import { Application } from "pixi.js";
import { TILE_W, TILE_H, AGENT_SPEED } from "./constants";
import { toScreen, findPath, createTerrainGrid, computeWallTiles } from "./map";
import { createTileGrid, createTileHighlight, updateTileHighlight } from "./map/tileRenderer";
import { AgentEntity } from "./entities/Agent";
import { BuildingEntity } from "./entities/Building";
import { ParticleSystem } from "./systems/ParticleSystem";
import { useGameStore } from "../store/gameStore";

/**
 * GameCanvas — The PixiJS mount point.
 *
 * This component:
 * 1. Creates the PixiJS Application
 * 2. Draws the isometric tile grid
 * 3. Creates agent and building entities
 * 4. Runs the game loop (movement, state transitions)
 * 5. Handles mouse input (click to assign, hover for tooltips)
 * 6. Bridges game events to the Zustand store
 */
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;
    const store = useGameStore.getState();

    async function init() {
      const app = new Application();
      await app.init({
        resizeTo: containerRef.current!,
        backgroundColor: "#1a1a2e",
        antialias: true,
      });

      if (destroyed) { app.destroy(); return; }

      appRef.current = app;
      containerRef.current!.appendChild(app.canvas);

      const width = app.screen.width;
      const height = app.screen.height;
      const offsetX = width / 2;
      const offsetY = 100;

      // ─── Terrain ───
      const terrain = createTerrainGrid();
      const walls = computeWallTiles(store.buildings);
      const tileGrid = createTileGrid(terrain, offsetX, offsetY);
      app.stage.addChild(tileGrid);

      // ─── Tile hover highlight ───
      const highlight = createTileHighlight();
      app.stage.addChild(highlight);

      // ─── Home marker ───
      // (Drawn as part of tile grid in Phase 2 — skip for now)

      // ─── Buildings ───
      const buildingEntities: BuildingEntity[] = store.buildings.map((b) => {
        const entity = new BuildingEntity(
          { id: b.id, name: b.name, emoji: b.emoji, tileX: b.tileX, tileY: b.tileY, color: b.color, roofColor: b.roofColor },
          offsetX, offsetY
        );
        app.stage.addChild(entity.container);
        return entity;
      });

      // ─── Agent ───
      const agentDef = store.agents[0];
      const agentStart = toScreen(agentDef.tileX, agentDef.tileY, offsetX, offsetY);
      const agent = new AgentEntity(agentDef.id, agentDef.name, agentStart.x, agentStart.y);
      app.stage.addChild(agent.container);

      // ─── Particles ───
      const particles = new ParticleSystem();
      app.stage.addChild(particles.graphics);

      // ─── Movement state ───
      let path: Array<{ x: number; y: number }> = [];
      let pathIdx = 0;
      let agentTileX = agentDef.tileX;
      let agentTileY = agentDef.tileY;
      let targetBuilding: (typeof store.buildings)[0] | null = null;

      // ─── Task simulation ───
      function runSimulatedTask(building: (typeof store.buildings)[0]) {
        const { addChat, setActiveTask, updateTaskProgress, showNotification, incrementTasksCompleted, addTokensUsed } = useGameStore.getState();

        agent.state = "WORKING";
        agent.progress = 0;
        store.updateAgent(agentDef.id, { state: "WORKING" });
        setActiveTask({ buildingId: building.id, agentId: agentDef.id, progress: 0, startedAt: Date.now() });
        addChat("command", `> ${building.command} ${building.args.join(" ")}`);

        let progress = 0;
        const interval = setInterval(() => {
          progress += 0.15;
          if (progress >= 1) {
            clearInterval(interval);
            agent.progress = 1;
            updateTaskProgress(1);
            particles.emit(agent.screenX, agent.screenY - 20, 20, "#FFD700");

            addChat("success", `✅ Task complete: ${building.name}`);
            showNotification(`${building.name} — Task Complete!`, building.name, building.emoji);
            incrementTasksCompleted();
            addTokensUsed(Math.floor(Math.random() * 5000 + 2000));

            setTimeout(() => {
              setActiveTask(null);

              // Return home
              const homePath = findPath(agentTileX, agentTileY, agentDef.homeTileX, agentDef.homeTileY, walls);
              if (homePath && homePath.length > 1) {
                path = homePath;
                pathIdx = 1;
                agent.state = "RETURNING";
                store.updateAgent(agentDef.id, { state: "RETURNING" });
              } else {
                agent.state = "IDLE";
                store.updateAgent(agentDef.id, { state: "IDLE" });
                useGameStore.getState().addChat("system", "Merlin has returned home");
              }
              targetBuilding = null;
            }, 500);
          } else {
            agent.progress = progress;
            updateTaskProgress(progress);
            addChat("output", `  Processing... ${Math.floor(progress * 100)}%`);
          }
        }, 600);
      }

      // ─── Mouse: Click ───
      app.canvas.addEventListener("click", (e: MouseEvent) => {
        if (agent.state !== "IDLE") return;

        const rect = app.canvas.getBoundingClientRect();
        const scaleX = app.screen.width / rect.width;
        const scaleY = app.screen.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        for (const be of buildingEntities) {
          if (be.hitTest(mx, my)) {
            const building = store.buildings.find((b) => b.id === be.config.id)!;
            const foundPath = findPath(agentTileX, agentTileY, building.doorTileX, building.doorTileY, walls);
            if (foundPath && foundPath.length > 1) {
              path = foundPath;
              pathIdx = 1;
              agent.state = "WALKING";
              store.updateAgent(agentDef.id, { state: "WALKING" });
              targetBuilding = building;
              useGameStore.getState().addChat("action", `Sending ${agentDef.name} to ${building.name}...`);
            }
            return;
          }
        }
      });

      // ─── Mouse: Hover ───
      app.canvas.addEventListener("mousemove", (e: MouseEvent) => {
        const rect = app.canvas.getBoundingClientRect();
        const scaleX = app.screen.width / rect.width;
        const scaleY = app.screen.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        let anyHovered = false;
        for (const be of buildingEntities) {
          const hovered = be.hitTest(mx, my);
          be.isHovered = hovered;
          if (hovered) anyHovered = true;
        }

        app.canvas.style.cursor = anyHovered && agent.state === "IDLE" ? "pointer" : "default";
      });

      // ─── Game Loop ───
      app.ticker.add(() => {
        // Movement
        if ((agent.state === "WALKING" || agent.state === "RETURNING") && path.length > 0) {
          const targetTile = path[pathIdx];
          if (targetTile) {
            const targetScreen = toScreen(targetTile.x, targetTile.y, offsetX, offsetY);
            const arrived = agent.moveToward(targetScreen.x, targetScreen.y, AGENT_SPEED);
            if (arrived) {
              agentTileX = targetTile.x;
              agentTileY = targetTile.y;
              store.updateAgent(agentDef.id, { tileX: targetTile.x, tileY: targetTile.y });
              pathIdx++;

              if (pathIdx >= path.length) {
                path = [];
                if (agent.state === "WALKING" && targetBuilding) {
                  const activeBE = buildingEntities.find((be) => be.config.id === targetBuilding!.id);
                  if (activeBE) activeBE.isActive = true;
                  runSimulatedTask(targetBuilding);
                } else if (agent.state === "RETURNING") {
                  agent.state = "IDLE";
                  store.updateAgent(agentDef.id, { state: "IDLE" });
                  useGameStore.getState().addChat("system", `${agentDef.name} has returned home`);
                  for (const be of buildingEntities) be.isActive = false;
                }
              }
            }
          }
        }

        // Update entities
        agent.update();
        for (const be of buildingEntities) be.update();
        particles.update();
      });
    }

    init();

    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
      }}
    />
  );
}
