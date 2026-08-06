import { useMutation } from 'convex/react'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { fmt, useMessages } from '../../lib/i18n'

/** How long the offer to undo stands before the diary is just the diary again. */
const UNDO_MS = 6000

interface JustLogged {
  /**
   * Report what was just written, so it can be taken back. A list because one
   * confirmation can produce several entries.
   */
  announce: (label: string, entryIds: Id<'consumptionEntries'>[]) => void
}

const JustLoggedContext = createContext<JustLogged | null>(null)

/**
 * The confirmation that something reached the diary, and the chance to undo it.
 *
 * It lives above the add sheet rather than inside it because confirming closes
 * the sheet: a toast owned by the sheet would be unmounted by the very action
 * it is reporting. The diary route wraps both, so the sheet can announce on its
 * way out and the message outlives it.
 */
export function JustLoggedProvider({ children }: { children: ReactNode }) {
  const [logged, setLogged] = useState<{
    label: string
    entryIds: Id<'consumptionEntries'>[]
  } | null>(null)
  const [undoing, setUndoing] = useState(false)
  const [failed, setFailed] = useState(false)
  const remove = useMutation(api.consumption.remove)
  const { add } = useMessages().nutrition.diary

  const announce = useCallback(
    (label: string, entryIds: Id<'consumptionEntries'>[]) => {
      setFailed(false)
      setLogged({ label, entryIds })
    },
    [],
  )

  useEffect(() => {
    if (!logged) return
    const id = setTimeout(() => setLogged(null), UNDO_MS)
    return () => clearTimeout(id)
  }, [logged])

  return (
    <JustLoggedContext.Provider value={{ announce }}>
      {children}
      {logged && (
        <div className="fixed inset-x-3 bottom-4 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-xl bg-[var(--app-fg)] px-4 py-3 text-sm text-[var(--app-surface)] shadow-xl">
          <span className="min-w-0 flex-1">
            {failed ? add.undoFailed : fmt(add.logged, { label: logged.label })}
          </span>
          {!failed && (
            <button
              type="button"
              disabled={undoing}
              onClick={async () => {
                setUndoing(true)
                try {
                  for (const id of logged.entryIds) await remove({ id })
                  setLogged(null)
                } catch {
                  setFailed(true)
                } finally {
                  setUndoing(false)
                }
              }}
              className="min-h-11 shrink-0 font-semibold underline disabled:opacity-60"
            >
              {add.undo}
            </button>
          )}
        </div>
      )}
    </JustLoggedContext.Provider>
  )
}

/**
 * Reporting what was logged is optional: the sheet is rendered by a route
 * inside the diary, but a component test renders it on its own and has nothing
 * to report to. A no-op there is honest — nothing is listening.
 */
export function useJustLogged(): JustLogged {
  return useContext(JustLoggedContext) ?? { announce: () => {} }
}
