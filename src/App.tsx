import { GameCanvas } from "./game/GameCanvas";
import { TopBar } from "./ui/panels/TopBar";
import { ChatPanel } from "./ui/panels/ChatPanel";
import { MissionPanel } from "./ui/panels/MissionPanel";
import { Notification } from "./ui/panels/Notification";
import { Minimap } from "./ui/panels/Minimap";

export default function App() {
  return (
    <div className="app-shell">
      {/* Game world — PixiJS canvas fills the viewport */}
      <GameCanvas />

      {/* React HUD panels — absolutely positioned over the canvas */}
      <TopBar />
      <MissionPanel />
      <ChatPanel />
      <Minimap />
      <Notification />
    </div>
  );
}
