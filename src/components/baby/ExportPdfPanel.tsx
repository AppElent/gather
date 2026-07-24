import { useConvex } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { BabyEventType } from '../../../convex/lib/babyEvents'
import {
  BABY_EVENT_LABELS,
  BABY_EVENT_TYPES,
} from '../../../convex/lib/babyEvents'
import {
  combineDateTime,
  toDateInputValue,
  toTimeInputValue,
} from '../../lib/babyDate'
import { SurfaceCard } from '../app/ShellPrimitives'

const inputClass =
  'w-full min-w-0 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]'

interface ExportPdfPanelProps {
  babyId: Id<'babies'>
  babyName: string
  babyBirthDate: string
  onClose: () => void
}

export function ExportPdfPanel({
  babyId,
  babyName,
  babyBirthDate,
  onClose,
}: ExportPdfPanelProps) {
  const convex = useConvex()
  // From defaults to birth date at the very start of that day; To defaults
  // to right now (not midnight) so the default range never silently
  // excludes everything logged today.
  const [fromMs, setFromMs] = useState(() =>
    combineDateTime(babyBirthDate, '00:00'),
  )
  const [toMs, setToMs] = useState(() => Date.now())
  const [types, setTypes] = useState<BabyEventType[]>([...BABY_EVENT_TYPES])
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleType(t: BabyEventType) {
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    )
  }

  async function runExport() {
    setExporting(true)
    setError(null)
    try {
      // jsPDF + jspdf-autotable are ~140KB gzipped — load them only when the
      // user actually exports, instead of on every visit to this page.
      const { exportBabyLogPdf } = await import('../../lib/babyPdfExport')
      const events = await convex.query(api.babyEvents.listByBaby, {
        babyId,
        from: fromMs,
        to: toMs,
      })
      exportBabyLogPdf({
        baby: { name: babyName, birthDate: babyBirthDate },
        events,
        from: fromMs,
        to: toMs,
        types,
      })
      onClose()
    } catch {
      setError('Could not generate the PDF')
    } finally {
      setExporting(false)
    }
  }

  return (
    <SurfaceCard>
      <h2 className="m-0 mb-3 text-sm font-semibold">Export PDF</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <span className="mb-1 block text-sm font-medium">From</span>
          <div className="flex gap-2">
            <input
              type="date"
              className={inputClass}
              value={toDateInputValue(fromMs)}
              onChange={(e) =>
                setFromMs(
                  combineDateTime(e.target.value, toTimeInputValue(fromMs)),
                )
              }
            />
            <input
              type="time"
              className={inputClass}
              value={toTimeInputValue(fromMs)}
              onChange={(e) =>
                setFromMs(
                  combineDateTime(toDateInputValue(fromMs), e.target.value),
                )
              }
            />
          </div>
        </div>
        <div className="min-w-0">
          <span className="mb-1 block text-sm font-medium">To</span>
          <div className="flex gap-2">
            <input
              type="date"
              className={inputClass}
              value={toDateInputValue(toMs)}
              onChange={(e) =>
                setToMs(combineDateTime(e.target.value, toTimeInputValue(toMs)))
              }
            />
            <input
              type="time"
              className={inputClass}
              value={toTimeInputValue(toMs)}
              onChange={(e) =>
                setToMs(combineDateTime(toDateInputValue(toMs), e.target.value))
              }
            />
          </div>
        </div>
      </div>

      <fieldset className="mt-3">
        <legend className="mb-1 text-sm font-medium">Include</legend>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {BABY_EVENT_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={types.includes(t)}
                onChange={() => toggleType(t)}
              />
              {BABY_EVENT_LABELS[t]}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="mt-3 text-sm text-red-800">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={exporting || types.length === 0}
          onClick={runExport}
          className="min-h-9 rounded-[var(--app-radius)] border border-[var(--app-fg)] bg-[var(--app-fg)] px-3 text-sm font-semibold text-[var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? 'Generating…' : 'Download PDF'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 px-2 text-sm text-[var(--app-muted)]"
        >
          Cancel
        </button>
      </div>
    </SurfaceCard>
  )
}
