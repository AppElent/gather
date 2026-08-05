import { useUser } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import { useMessages } from '../../lib/i18n'
import type { IssueReporterType } from '../../lib/issueReporter'
import { ISSUE_REPORTER_TYPES } from '../../lib/issueReporter'
import { reportIssue } from '../../server/reportIssue'

type SubmitStatus =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'success'; issueUrl: string }
  | { state: 'error'; error: string }

export function IssueReporterModal() {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<IssueReporterType>('bug')
  const [text, setText] = useState('')
  const [status, setStatus] = useState<SubmitStatus>({ state: 'idle' })
  const { user } = useUser()
  const messages = useMessages()
  const { issueReporter } = messages.shell

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
          user: user
            ? {
                id: user.id,
                email: user.primaryEmailAddress?.emailAddress,
                name: user.fullName ?? undefined,
              }
            : undefined,
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
        className="w-full max-w-md rounded-xl border bg-white p-4 shadow-lg dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-semibold">{issueReporter.title}</h2>
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
            <textarea
              autoFocus
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
