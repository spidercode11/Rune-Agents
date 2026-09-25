import { useGameStore } from '../../store/gameStore'
import { tasksForSkills } from '../../data/tasks'
import { gameBridge } from '../../game/gameBridge'
import { CharacterPortrait } from './CharacterPortrait'
import { PromptPanel } from './PromptPanel'
import styles from './CharacterHud.module.css'

export function CharacterHud() {
  const characterHudOpen = useGameStore((s) => s.characterHudOpen)
  const selectedAgentId = useGameStore((s) => s.selectedAgentId)
  const agents = useGameStore((s) => s.agents)
  const dispatchTargets = useGameStore((s) => s.dispatchTargets)
  const sendToExpanded = useGameStore((s) => s.sendToExpanded)
  const pendingTargetId = useGameStore((s) => s.pendingTargetId)
  const closeCharacterHud = useGameStore((s) => s.closeCharacterHud)
  const toggleSendTo = useGameStore((s) => s.toggleSendTo)
  const openPrompt = useGameStore((s) => s.openPrompt)
  const setPendingTarget = useGameStore((s) => s.setPendingTarget)

  if (!characterHudOpen || !selectedAgentId) return null

  const agent = agents.find((a) => a.id === selectedAgentId)
  if (!agent) return null

  const tasks = tasksForSkills(agent.skills)
  const isIdle = agent.state === 'IDLE'

  const handleProjectClick = (targetId: string) => {
    setPendingTarget(targetId)
    if (isIdle) {
      gameBridge.dispatch(selectedAgentId, targetId)
      closeCharacterHud()
    }
  }

  const handleTaskClick = (label: string, prompt: string) => {
    openPrompt(label, prompt)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.hudRow}>
        <div className={styles.panel}>
          <div className={styles.headerRow}>
            <div className={styles.namePill}>{agent.name}</div>
            <button
              type="button"
              className={`${styles.sendToBtn} ${sendToExpanded ? styles.sendToBtnActive : ''}`}
              onClick={toggleSendTo}
            >
              Send To:
            </button>
          </div>

          <div className={styles.body}>
            <div className={styles.skillsCol}>
              <div className={styles.skillsLabel}>Skills:</div>
              {tasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={styles.skillBtn}
                  disabled={!isIdle && task.id !== 'custom'}
                  onClick={() => handleTaskClick(task.label, task.prompt)}
                >
                  {task.label}
                </button>
              ))}
            </div>

            {sendToExpanded && (
              <div className={styles.sendToCol}>
                <div className={styles.projectList}>
                  {dispatchTargets.length === 0 ? (
                    <p className={styles.projectEmpty}>
                      No projects yet. Press T or C to place one.
                    </p>
                  ) : (
                    dispatchTargets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={styles.projectBtn}
                        style={{
                          color: pendingTargetId === t.id ? '#ffd700' : undefined,
                        }}
                        onClick={() => handleProjectClick(t.id)}
                      >
                        {t.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {!isIdle && (
            <p className={styles.busyNote}>
              {agent.state === 'WORKING' ? 'Working…' : 'On a quest — wait to dispatch.'}
            </p>
          )}

          <div className={styles.portraitRow}>
            <CharacterPortrait characterType={agent.characterType} />
            <button type="button" className={styles.closeBtn} onClick={closeCharacterHud}>
              (close)
            </button>
          </div>
        </div>

        <PromptPanel />
      </div>
    </div>
  )
}
