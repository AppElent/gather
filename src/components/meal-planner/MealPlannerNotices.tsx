import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useMessages } from '../../lib/i18n'
import { useCurrentGroup } from '../app/useCurrentGroup'

interface Notice {
  message: string
  failed?: boolean
  undo?: () => void
}

interface Notices {
  show: (notice: Notice) => void
  /** The planner's one "did not work" line, unless given its own words. */
  fail: (message?: string) => void
}

const NoticesContext = createContext<Notices | null>(null)

export function useMealPlannerNotices(): Notices {
  const notices = useContext(NoticesContext)
  if (!notices) throw new Error('Meal planner notices are missing')
  return notices
}

const NOTICE_MS = 8000

/**
 * The one line that says what happened, with its Undo. It sits above the
 * planner's pages (the layout route), so it survives a meal's page closing.
 */
export function MealPlannerNotices({ children }: { children: ReactNode }) {
  // A Group switch takes the notice, and its Undo, with it.
  const slug = useCurrentGroup().current?.slug
  return <NoticesOf key={slug}>{children}</NoticesOf>
}

function NoticesOf({ children }: { children: ReactNode }) {
  const words = useMessages().mealPlanner
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const value = useMemo(
    () => ({
      show: setNotice,
      fail: (message: string = words.failed) =>
        setNotice({ message, failed: true }),
    }),
    [words.failed],
  )

  return (
    <NoticesContext value={value}>
      {children}

      {/* Present before anything is said, so it is read out when it is. */}
      <div
        role={notice?.failed ? 'alert' : 'status'}
        data-group="kitchen"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[60] flex justify-center md:bottom-6"
      >
        {notice ? (
          <div className="pointer-events-auto flex max-w-[560px] flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[var(--radius-card)] border-[0.5px] border-[var(--hair-strong)] bg-[var(--surface)] px-4 py-2 text-subhead text-[var(--ink)] shadow-lg">
            <span
              className={`py-1.5 ${
                notice.failed ? 'font-semibold text-[var(--danger)]' : ''
              }`}
            >
              {notice.message}
            </span>
            {notice.undo ? (
              <button
                type="button"
                onClick={() => {
                  notice.undo?.()
                  setNotice(null)
                }}
                className="min-h-[var(--size-control-min)] cursor-pointer border-0 bg-transparent px-2 font-semibold text-[var(--accent-text)]"
              >
                {words.undo}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </NoticesContext>
  )
}
