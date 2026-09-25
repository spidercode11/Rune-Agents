import { useGameStore } from "../../store/gameStore";

export function TopBar() {
  const stats = useGameStore((s) => s.stats);
  const agents = useGameStore((s) => s.agents);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 12px",
        background: "linear-gradient(180deg, #3B3024 0%, #2A2018 100%)",
        borderBottom: "2px solid #5C4A32",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* Left side */}
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span
          style={{
            color: "#FF981F",
            fontWeight: "bold",
            fontSize: 13,
            letterSpacing: 1,
            fontFamily: "var(--font-pixel)",
          }}
        >
          ⚔️ RUNEAGENTS
        </span>
        <span style={{ color: "#FFD700", fontSize: 11 }}>
          🪙 {stats.tokensUsed.toLocaleString()} tokens
        </span>
        <span style={{ color: "#AAA", fontSize: 11 }}>
          👤 {agents.filter((a) => a.state !== "IDLE").length}/{agents.length} agents
        </span>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ color: "#AAA", fontSize: 11 }}>
          📋 Tasks: {stats.tasksCompleted}
        </span>
        <span
          style={{
            background: "#00AA00",
            color: "#FFF",
            fontSize: 9,
            padding: "2px 8px",
            borderRadius: 3,
            fontWeight: "bold",
          }}
        >
          ONLINE
        </span>
      </div>
    </div>
  );
}
