import { useGameStore } from "../../store/gameStore";

/**
 * Minimap — a simplified top-down view of the village.
 * Shows building positions as colored dots and the agent as a moving dot.
 * Phase 1: Simple canvas-based rendering. Phase 2+: Interactive click-to-scroll.
 */
export function Minimap() {
  const agents = useGameStore((s) => s.agents);
  const buildings = useGameStore((s) => s.buildings);
  const agent = agents[0];

  const SIZE = 100;
  const GRID = 13;
  const CELL = SIZE / GRID;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 148,
        left: 8,
        zIndex: 10,
        width: SIZE,
        height: SIZE,
        background: "#0a0a0aCC",
        border: "1px solid #5C4A32",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {/* Buildings */}
      {buildings.map((b) => (
        <div
          key={b.id}
          style={{
            position: "absolute",
            left: b.tileX * CELL,
            top: b.tileY * CELL,
            width: CELL * 2,
            height: CELL * 2,
            background: b.color + "AA",
            borderRadius: 2,
          }}
          title={b.name}
        />
      ))}

      {/* Agent dot */}
      {agent && (
        <div
          style={{
            position: "absolute",
            left: agent.tileX * CELL - 3,
            top: agent.tileY * CELL - 3,
            width: 6,
            height: 6,
            background: "#FFD700",
            borderRadius: "50%",
            boxShadow: "0 0 4px #FFD700",
            transition: "left 0.3s, top 0.3s",
          }}
        />
      )}

      {/* Home marker */}
      {agent && (
        <div
          style={{
            position: "absolute",
            left: agent.homeTileX * CELL - 2,
            top: agent.homeTileY * CELL - 2,
            width: 4,
            height: 4,
            background: "#FF981F44",
            border: "1px solid #FF981F",
            borderRadius: "50%",
          }}
        />
      )}
    </div>
  );
}
