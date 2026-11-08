import { useUser } from '@clerk/react'
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { useMessages } from '../../lib/i18n'
import type { IssueReporterType } from '../../lib/issueReporter'
import { ISSUE_REPORTER_TYPES } from '../../lib/issueReporter'
import { reportIssue } from '../../server/reportIssue'
import { useModalFocus } from './useModalFocus'

type SubmitStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'success'; issueUrl: string }
  | { state: 'error'; error: string }

/**
 * Filing a bug or an idea from wherever you are. The shell owns whether it is
 * open, so Ctrl+Shift+I and the topbar's button open the same thing.
 */
export function IssueReporterModal({
  open,
  onOpenChange: setOpen,
}: {
  open: boolean
  onOpenChange: Dispatch<SetStateAction<boolean>>
}) {
  const [type, setType] = useState<IssueReporterType>('bug')
  const [text, setText] = useState('')
  const [status, setStatus] = useState<SubmitStatus>({ state: 'idle' })
  const { user } = useUser()
  const messages = useMessages()
  const { issueReporter } = messages.shell
  const titleId = useId()
  const textRef = useRef<HTMLTextAreaElement>(null)
  const { ref, onKeyDown } = useModalFocus<HTMLDivElement>({
    open,
    onClose: () => setOpen(false),
    initialFocus: textRef,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  if (!open) return null

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault()
    if (!text.trim()) return
    setStatus({ state: 'submitting' })
    try {
      const result = await reportIssue({
        data: {
          type,
          text,
          url: window.location.href,
          signedIn: Boolean(user),
        },
      })
      if (result.ok) {
        setStatus({ state: 'success', issueUrl: result.issueUrl })
        setText('')
      } else {
        setStatus({ state: 'error', error: result.error })
      }
    } catch {
      setStatus({ state: 'error', error: issueReporter.unreachable })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-32"
      onClick={() => setOpen(false)}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border bg-white p-4 shadow-lg dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="mb-3 text-sm font-semibold">
          {issueReporter.title}
        </h2>
        {status.state === 'success' ? (
          <div className="space-y-3 text-sm">
            <p>{issueReporter.filed}</p>
            {status.issueUrl && (
              <a
                href={status.issueUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-emerald-600 underline dark:text-emerald-400"
              >
                {issueReporter.viewIssue}
              </a>
            )}
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm"
              onClick={() => {
                setOpen(false)
                setStatus({ state: 'idle' })
              }}
            >
              {messages.common.actions.close}
            </button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={handleSubmit}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as IssueReporterType)}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            >
              {ISSUE_REPORTER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {issueReporter.types[t]}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {issueReporter.publicNotice}
            </p>
            <textarea
              ref={textRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={issueReporter.placeholder}
              rows={4}
              className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
            />
            {status.state === 'error' && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {status.error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm"
                onClick={() => setOpen(false)}
              >
                {messages.common.actions.cancel}
              </button>
              <button
                type="submit"
                disabled={status.state === 'submitting' || !text.trim()}
                className="rounded-md border bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {status.state === 'submitting'
                  ? issueReporter.sending
                  : issueReporter.send}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
