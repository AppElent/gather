import { describe, expect, test } from 'vitest'
import { pacedWrite, WRITE_RETRY_MS, writePauseMs } from './energyWritePace'

/** A year of hours stays under the deployment's bytes written per second. */
describe('pacedWrite', () => {
  function harness(refusals: number) {
    const pauses: number[] = []
    let calls = 0
    const run = () =>
      pacedWrite(
        500,
        async () => {
          calls += 1
          if (calls <= refusals) throw new Error('TooManyWrites')
          return 'stored'
        },
        async (ms) => {
          pauses.push(ms)
        },
      )
    return { run, pauses, calls: () => calls }
  }

  test('pauses after a write for the rows it wrote', async () => {
    const { run, pauses } = harness(0)
    expect(await run()).toBe('stored')
    expect(pauses).toEqual([writePauseMs(500)])
    // Half a kilobyte a row: at most 1 MiB/s.
    expect((500 * 512) / (writePauseMs(500) / 1000)).toBeLessThanOrEqual(1024 * 1024)
  })

  test('a refused write is tried again after a longer pause', async () => {
    const { run, pauses } = harness(2)
    expect(await run()).toBe('stored')
    expect(pauses).toEqual([WRITE_RETRY_MS[0], WRITE_RETRY_MS[1], writePauseMs(500)])
  })

  test('gives up with the error after the last try', async () => {
    const { run, calls } = harness(99)
    await expect(run()).rejects.toThrow('TooManyWrites')
    expect(calls()).toBe(WRITE_RETRY_MS.length + 1)
  })
})
