import type { CharacterType } from '../game/Agent'

/** Default equipped skills per character slot (maps to Forge / CLI tools). */
export const SKILLS_BY_CHARACTER: Record<CharacterType, string[]> = {
  wizard:    ['Edit', 'Read', 'Write', 'WebSearch'],
  ranger:    ['Read', 'Git', 'Bash', 'WebSearch'],
  knight:    ['Bash', 'Git', 'Deploy', 'Read'],
  alchemist: ['Write', 'Test', 'Read', 'Edit'],
  cleric:    ['Write', 'Read', 'Test', 'Edit'],
}
