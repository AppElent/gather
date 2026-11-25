/**
 * Saves that failed after their field had gone. The Tasks layout says so; with
 * Tasks itself closed by then, it does when Tasks is next opened.
 */
type Hear = (error: unknown) => void

const hearing = new Set<Hear>()
let waiting: { error: unknown } | undefined

export function reportLostSave(error: unknown) {
  if (hearing.size === 0) waiting = { error }
  for (const hear of hearing) hear(error)
}

export function hearLostSaves(hear: Hear): () => void {
  hearing.add(hear)
  if (waiting) {
    const { error } = waiting
    waiting = undefined
    hear(error)
  }
  return () => {
    hearing.delete(hear)
  }
}
