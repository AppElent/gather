/**
 * How fast the big energy jobs write (APP-495). A deployment has a limit on
 * bytes written per second (4 MiB on the smallest class), shared with
 * everyone using the app, and a year of hours written at full speed runs into
 * it. An hour's row with its indexes is under 0.5 kB, so this stays
 * below a quarter of that.
 */
const ROWS_PER_SECOND = 2000

/** The pause after writing or deleting `rows` hours, in milliseconds. */
export function writePauseMs(rows: number): number {
  return Math.ceil((rows / ROWS_PER_SECOND) * 1000)
}

/** Between two tries of a write the deployment refused. */
export const WRITE_RETRY_MS: readonly number[] = [2000, 5000, 15_000]

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Write `rows` hours, then pause for as long as they count. A refused write is
 * tried again, so it has to be one that storing twice does not change.
 */
export async function pacedWrite<T>(
  rows: number,
  write: () => Promise<T>,
  pause: (ms: number) => Promise<void> = sleep,
): Promise<T> {
  for (let tried = 0; ; tried += 1) {
    try {
      const result = await write()
      await pause(writePauseMs(rows))
      return result
    } catch (error) {
      const wait = WRITE_RETRY_MS[tried]
      if (wait === undefined) throw error
      await pause(wait)
    }
  }
}
