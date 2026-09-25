import type { CharacterType } from '../../game/Agent'
import styles from './CharacterHud.module.css'

const PORTRAIT: Record<CharacterType, string> = {
  wizard:    '🧙',
  ranger:    '🏹',
  knight:    '⚔️',
  alchemist: '⚗️',
  cleric:    '✨',
}

interface Props {
  characterType: CharacterType
}

export function CharacterPortrait({ characterType }: Props) {
  return (
    <div className={styles.portrait} aria-hidden>
      {PORTRAIT[characterType]}
    </div>
  )
}
