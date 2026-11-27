/**
 * The lines the phone could not read, asked of the AI in batches (APP-423):
 * one call carries at most `AI_LINES_MAX` lines (`convex/lib/groceryLinesAi.ts`),
 * and each call counts against the person's daily cap, so a week with more
 * unread lines than that takes several. The calls run one after the other: the
 * first answer that is not a reading (over the cap, offline, no answer) stops
 * the rest, which are added as plain text, as before.
 */
import type { GroceryUnit } from './parse'

/** What the AI read in one line. */
export interface CachedRead {
  name: string
  quantity?: number
  unit?: GroceryUnit
}

/** The lines one call may carry (`convex/lib/groceryLinesAi.ts`). */
export const AI_LINES_MAX = 40

/**
 * How long one call may take (APP-590). Runs take turns, so a call that never
 * settles would hold up every later run; past this its lines are plain text.
 * Generous: one call of 40 lines can take a while, a hang is what it catches.
 */
export const READ_TIMEOUT_MS = 60_000

export interface AiCount {
  used: number
  limit: number
}

/** What `groceryLines.read` answers. */
export type ReadAnswer =
  | { status: 'read'; used: number; limit: number; lines: (CachedRead | null)[] }
  | { status: 'limit'; limit: number }
  | { status: 'unavailable' }

export interface ReadBatch {
  texts: string[]
  /** One per text: what the AI read, or null for plain text. */
  lines: (CachedRead | null)[]
  count: AiCount
}

/** Why the batches stopped: all answered, over the cap, or no answer. */
export type BatchesEnd = 'done' | 'limit' | 'unavailable' | 'stopped'

/** `promise`, or a rejection once `ms` have passed without it settling. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Ask for `texts` in batches. `onBatch` hears each answered batch as it
 * arrives. `live` is asked before every call, so a sheet that went away, or
 * lines that changed, stop the loop; a call already out is not thrown away
 * (APP-479): it has counted against the cap, so its answer is still heard.
 * A call that takes longer than `timeoutMs` counts as no answer (APP-590).
 * Resolves with why it ended once every line is answered or the AI stopped.
 */
export async function readInBatches(
  texts: readonly string[],
  read: (lines: string[]) => Promise<ReadAnswer>,
  onBatch: (batch: ReadBatch) => void,
  live: () => boolean = () => true,
  timeoutMs: number = READ_TIMEOUT_MS,
): Promise<BatchesEnd> {
  for (let start = 0; start < texts.length; start += AI_LINES_MAX) {
    if (!live()) return 'stopped'
    const batch = texts.slice(start, start + AI_LINES_MAX)
    let answer: ReadAnswer
    try {
      answer = await withTimeout(read(batch), timeoutMs)
    } catch {
      return 'unavailable'
    }
    if (answer.status !== 'read') return answer.status
    onBatch({
      texts: batch,
      lines: batch.map((_, index) => answer.lines[index] ?? null),
      count: { used: answer.used, limit: answer.limit },
    })
  }
  return 'done'
}
