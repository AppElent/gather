/**
 * The lines the phone could not read, asked of the AI in batches (APP-423):
 * one call carries at most `AI_LINES_MAX` lines (`convex/lib/groceryLinesAi.ts`),
 * and each call counts against the person's daily cap, so a week with more
 * unread lines than that takes several. The calls run one after the other: the
 * first answer that is not a reading (over the cap, offline, no answer) stops
 * the rest, which are added as plain text, as before.
 */
import type { CachedRead } from './line-cache'

/** The lines one call may carry (`convex/lib/groceryLinesAi.ts`). */
export const AI_LINES_MAX = 40

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

/**
 * Ask for `texts` in batches. `onBatch` hears each answered batch as it
 * arrives; `live` is asked before every call and after every answer, so a
 * sheet that went away stops the loop. Resolves when every line is answered or
 * the AI stopped answering.
 */
export async function readInBatches(
  texts: readonly string[],
  read: (lines: string[]) => Promise<ReadAnswer>,
  onBatch: (batch: ReadBatch) => void,
  live: () => boolean = () => true,
): Promise<void> {
  for (let start = 0; start < texts.length; start += AI_LINES_MAX) {
    if (!live()) return
    const batch = texts.slice(start, start + AI_LINES_MAX)
    let answer: ReadAnswer
    try {
      answer = await read(batch)
    } catch {
      return
    }
    if (!live() || answer.status !== 'read') return
    onBatch({
      texts: batch,
      lines: batch.map((_, index) => answer.lines[index] ?? null),
      count: { used: answer.used, limit: answer.limit },
    })
  }
}
