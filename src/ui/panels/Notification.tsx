import { useEffect } from "react";
import { useGameStore } from "../../store/gameStore";

export function Notification() {
  const notification = useGameStore((s) => s.notification);
  const clearNotification = useGameStore((s) => s.clearNotification);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(clearNotification, 4000);
    return () => clearTimeout(timer);
  }, [notification, clearNotification]);

  if (!notification) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 50,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        background: "linear-gradient(180deg, #3B3024 0%, #1a1208 100%)",
        border: "2px solid #FFD700",
        borderRadius: 6,
        padding: "10px 24px",
        textAlign: "center",
        boxShadow: "0 0 20px rgba(255, 215, 0, 0.3)",
        fontFamily: "var(--font-body)",
        animation: "slideDown 0.3s ease-out",
      }}
    >
      <div
        style={{
          color: "#FFD700",
          fontWeight: "bold",
          fontSize: 13,
          marginBottom: 4,
          fontFamily: "var(--font-pixel)",
        }}
      >
        🏆 QUEST COMPLETE
      </div>
      <div style={{ color: "#FF981F", fontSize: 11 }}>
        {notification.emoji} {notification.text}
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
