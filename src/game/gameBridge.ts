/** Callbacks registered by Pixi (IsometricMap) for React HUD actions. */

export type DispatchHandler = (
  agentId: string,
  targetId: string,
  prompt?: string,
) => void

let dispatchHandler: DispatchHandler | null = null

export const gameBridge = {
  registerDispatch(handler: DispatchHandler): void {
    dispatchHandler = handler
  },

  unregisterDispatch(): void {
    dispatchHandler = null
  },

  dispatch(agentId: string, targetId: string, prompt?: string): void {
    dispatchHandler?.(agentId, targetId, prompt)
  },
}
