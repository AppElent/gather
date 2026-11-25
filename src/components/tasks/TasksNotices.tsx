import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useErrorMessage } from '../../lib/errorMessage'
import { useI18n } from '../../lib/i18n'
import { useTaskLists } from './data'
import { hearLostSaves } from './lostSaves'
import { failureWords } from './words'

export interface Notice {
  message: string
  undo?: () => void
  /** Something that did not work. */
  failed?: boolean
}

interface Notices {
  show: (notice: Notice) => void
  /** Says why a write did not go through. */
  fail: (error: unknown, fallback?: string) => void
}

const NoticesContext = createContext<Notices | null>(null)

export function useTasksNotices(): Notices {
  const notices = useContext(NoticesContext)
  if (!notices) throw new Error('Tasks notices are missing')
  return notices
}

const NOTICE_MS = 8000

/**
 * The one line that says what happened, with its Undo. It sits above the Tasks
 * pages (the layout route), so a save that fails after its page has gone is
 * still said (APP-308).
 */
export function TasksNotices({ children }: { children: ReactNode }) {
  const { messages: t } = useI18n()
  const lists = useTaskLists()
  const errorText = useErrorMessage()
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const fail = (error: unknown, fallback: string = t.tasks.web.failed) =>
    setNotice({
      failed: true,
      message:
        failureWords(error, lists, t) ??
        errorText(error, fallback, t.tasks.assignee.refusals),
    })
  const failRef = useRef(fail)
  failRef.current = fail
  useEffect(() => hearLostSaves((error) => failRef.current(error)), [])

  return (
    <NoticesContext value={{ show: setNotice, fail }}>
      {children}

      {/* Present before anything is said, so it is read out when it is. */}
      <div
        role={notice?.failed ? 'alert' : 'status'}
        className="pointer-events-none fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 flex justify-center md:bottom-6"
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
                {t.tasks.repeat.undo}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </NoticesContext>
  )
}
