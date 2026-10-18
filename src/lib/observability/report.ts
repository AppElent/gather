/**
 * One place that reports a caught error, whichever runtime it is on. The
 * router and error boundaries call `reportError`; the browser entry and the
 * Worker entry each register the SDK that applies to them. Keeping the SDK out
 * of shared modules is what stops the Worker bundle pulling the browser SDK
 * and the browser bundle pulling the Worker one.
 */
type Sink = (error: Error) => void

let sink: Sink | undefined
const reported = new WeakSet<Error>()

export function setErrorSink(next: Sink | undefined) {
  sink = next
}

/** Reports once per error object; never throws, never swallows the original. */
export function reportError(error: unknown) {
  if (!sink) return
  const value =
    error instanceof Error ? error : new Error('Non-Error value thrown')
  if (reported.has(value)) return
  reported.add(value)
  try {
    sink(value)
  } catch {
    // Reporting must never break the UI path that called it.
  }
}
