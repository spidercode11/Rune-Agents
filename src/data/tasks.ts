/** Task commands shown in the character HUD (filtered by agent skills). */
export interface TaskDef {
  id: string
  label: string
  prompt: string
  requiredSkills: string[]
}

export const TASKS: TaskDef[] = [
  { id: 'refactor',   label: 'Refactor',           prompt: 'Refactor the codebase for clarity and maintainability.', requiredSkills: ['Edit'] },
  { id: 'fix_bug',    label: 'Fix Bug',            prompt: 'Find and fix the reported bug.',                        requiredSkills: ['Edit', 'Bash'] },
  { id: 'optimize',   label: 'Optimize',           prompt: 'Profile and optimize performance bottlenecks.',         requiredSkills: ['Edit', 'Read'] },
  { id: 'feature',    label: 'Implement Feature',  prompt: 'Implement the requested feature.',                    requiredSkills: ['Edit', 'Write'] },
  { id: 'review',     label: 'Code Review',        prompt: 'Review the code and suggest improvements.',           requiredSkills: ['Read'] },
  { id: 'tests',      label: 'Write Tests',        prompt: 'Write tests for the current module.',                 requiredSkills: ['Test', 'Edit'] },
  { id: 'docs',       label: 'Write Docs',         prompt: 'Write or update documentation.',                      requiredSkills: ['Write'] },
  { id: 'build',      label: 'Build',              prompt: 'Run the project build and fix any errors.',           requiredSkills: ['Bash'] },
  { id: 'git',        label: 'Git Ops',            prompt: 'Perform the requested git operations.',               requiredSkills: ['Git'] },
  { id: 'deploy',     label: 'Deploy',             prompt: 'Deploy the application.',                             requiredSkills: ['Deploy'] },
  { id: 'custom',     label: 'Custom Command',     prompt: '',                                                    requiredSkills: [] },
]

export function tasksForSkills(skills: string[]): TaskDef[] {
  return TASKS.filter(
    (t) =>
      t.requiredSkills.length === 0 ||
      t.requiredSkills.some((s) => skills.includes(s)),
  )
}
