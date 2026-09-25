import { useGameStore } from '../../store/gameStore'
import { gameBridge } from '../../game/gameBridge'
import styles from './CharacterHud.module.css'

export function PromptPanel() {
  const promptOpen = useGameStore((s) => s.promptOpen)
  const pendingTaskLabel = useGameStore((s) => s.pendingTaskLabel)
  const pendingPrompt = useGameStore((s) => s.pendingPrompt)
  const pendingTargetId = useGameStore((s) => s.pendingTargetId)
  const selectedAgentId = useGameStore((s) => s.selectedAgentId)
  const agents = useGameStore((s) => s.agents)
  const closePrompt = useGameStore((s) => s.closePrompt)
  const setPendingPrompt = useGameStore((s) => s.setPendingPrompt)

  if (!promptOpen || !selectedAgentId) return null

  const agent = agents.find((a) => a.id === selectedAgentId)
  const isIdle = agent?.state === 'IDLE'
  const canVenture = isIdle && pendingTargetId && pendingPrompt.trim().length > 0

  const handleVenture = () => {
    if (!canVenture || !pendingTargetId) return
    gameBridge.dispatch(selectedAgentId, pendingTargetId, pendingPrompt.trim())
    closePrompt()
    useGameStore.getState().closeCharacterHud()
  }

  return (
    <div className={styles.promptPanel}>
      <div className={styles.promptHeader}>
        <span />
        <span className={styles.promptTitle}>Prompt</span>
        <button
          type="button"
          className={styles.promptClose}
          onClick={closePrompt}
          aria-label="Close prompt"
        >
          ×
        </button>
      </div>
      {pendingTaskLabel && (
        <p style={{ fontSize: 11, marginBottom: 8, color: '#aaa' }}>{pendingTaskLabel}</p>
      )}
      <textarea
        className={styles.promptInput}
        value={pendingPrompt}
        onChange={(e) => setPendingPrompt(e.target.value)}
        placeholder="Enter your command…"
        autoFocus
      />
      <button
        type="button"
        className={styles.ventureBtn}
        disabled={!canVenture}
        onClick={handleVenture}
      >
        Venture
      </button>
      {!pendingTargetId && (
        <p className={styles.promptHint}>Pick a project under Send To first.</p>
      )}
      {pendingTargetId && !isIdle && (
        <p className={styles.promptHint}>Agent must be idle to venture.</p>
      )}
    </div>
  )
}
