import './App.css'
import GameCanvas from './game/GameCanvas'
import { CharacterHud } from './components/CharacterHud/CharacterHud'

export default function App() {
  return (
    <div className="app-root">
      <GameCanvas />
      <CharacterHud />
    </div>
  )
}
