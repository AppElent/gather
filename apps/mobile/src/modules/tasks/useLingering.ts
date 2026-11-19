import { useEffect, useRef, useState } from 'react'

/** How long a checked item stays in its aisle before it moves to Checked. */
export const LINGER_MS = 1500

/**
 * The ids of items checked while the list was open, for `LINGER_MS` after
 * each check. What was checked before the list's rows first arrived never
 * lingers: until `ready`, the rows are still loading and say nothing about
 * what the user just did.
 */
export function useLingering(
  tasks: readonly { id: string; done: boolean }[],
  ready: boolean,
): ReadonlySet<string> {
  const seen = useRef<Set<string> | null>(null)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const [lingering, setLingering] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (!ready) return
    const done = new Set(tasks.filter((task) => task.done).map((t) => t.id))
    const before = seen.current
    seen.current = done
    if (before === null) return
    const fresh = [...done].filter((id) => !before.has(id))
    if (fresh.length === 0) return
    setLingering((current) => new Set([...current, ...fresh]))
    for (const id of fresh) {
      clearTimeout(timers.current.get(id))
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id)
          setLingering((current) => {
            const next = new Set(current)
            next.delete(id)
            return next
          })
        }, LINGER_MS),
      )
    }
  }, [tasks, ready])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) clearTimeout(timer)
    }
  }, [])

  return lingering
}
