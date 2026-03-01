import { useEffect, useRef } from "react";
import { useGameStore } from "../../store/gameStore";

const MESSAGE_COLORS: Record<string, string> = {
  system: "#5555FF",
  hint: "#AAAA00",
  action: "#00CCFF",
  command: "#FF981F",
  output: "#CCCCCC",
  success: "#00FF00",
  error: "#FF4444",
};

export function ChatPanel() {
  const chatLog = useGameStore((s) => s.chatLog);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatLog]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        borderTop: "2px solid #5C4A32",
        background: "#1a1208",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "4px 12px",
          background: "#2A2018",
          borderBottom: "1px solid #3B3024",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: "#FF981F", fontSize: 10, fontWeight: "bold" }}>
          SESSION CHAT
        </span>
        <span style={{ color: "#666", fontSize: 9 }}>
          {chatLog.length} messages
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          height: 120,
          overflowY: "auto",
          padding: "6px 12px",
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        {chatLog.map((msg) => (
          <div key={msg.id} style={{ color: MESSAGE_COLORS[msg.type] || "#CCC" }}>
            {msg.type === "command" ? (
              <span style={{ color: "#FF981F" }}>{msg.text}</span>
            ) : msg.type === "output" ? (
              <span style={{ color: "#CCC" }}>  {msg.text}</span>
            ) : (
              <span>{msg.text}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
