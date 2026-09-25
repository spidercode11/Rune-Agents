import { useGameStore } from "../../store/gameStore";

export function MissionPanel() {
  const activeTask = useGameStore((s) => s.activeTask);
  const buildings = useGameStore((s) => s.buildings);

  if (!activeTask) {
    return (
      <div
        style={{
          position: "absolute",
          top: 48,
          right: 8,
          zIndex: 10,
          background: "#1a1a2eEE",
          border: "1px solid #5C4A32",
          borderRadius: 4,
          padding: "8px 12px",
          minWidth: 160,
          fontFamily: "var(--font-body)",
        }}
      >
        <div style={{ color: "#FF981F", fontSize: 10, fontWeight: "bold" }}>
          ACTIVE MISSIONS
        </div>
        <div style={{ color: "#666", fontSize: 10, fontStyle: "italic", marginTop: 4 }}>
          No active missions
        </div>
      </div>
    );
  }

  const building = buildings.find((b) => b.id === activeTask.buildingId);
  if (!building) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 48,
        right: 8,
        zIndex: 10,
        background: "#1a1a2eEE",
        border: "1px solid #5C4A32",
        borderRadius: 4,
        padding: "8px 12px",
        minWidth: 160,
        fontFamily: "var(--font-body)",
      }}
    >
      <div style={{ color: "#FF981F", fontSize: 10, fontWeight: "bold", marginBottom: 4 }}>
        ACTIVE MISSION
      </div>
      <div style={{ color: "#FFD700", fontSize: 11 }}>
        {building.emoji} {building.name}
      </div>
      <div style={{ color: "#888", fontSize: 9, marginTop: 2 }}>
        {building.description}
      </div>
      <div
        style={{
          background: "#333",
          height: 6,
          borderRadius: 3,
          marginTop: 8,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: "linear-gradient(90deg, #FFD700, #FF981F)",
            height: "100%",
            width: `${activeTask.progress * 100}%`,
            transition: "width 0.3s ease",
            borderRadius: 3,
          }}
        />
      </div>
      <div style={{ color: "#FFD700", fontSize: 9, textAlign: "right", marginTop: 2 }}>
        {Math.floor(activeTask.progress * 100)}%
      </div>
    </div>
  );
}
