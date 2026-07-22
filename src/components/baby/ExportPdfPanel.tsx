import { useConvex } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { BabyEventType } from '../../../convex/lib/babyEvents'
import {
  BABY_EVENT_LABELS,
  BABY_EVENT_TYPES,
} from '../../../convex/lib/babyEvents'
import { endOfDayMs, startOfDayMs } from '../../lib/babyDate'
import { SurfaceCard } from '../app/ShellPrimitives'

const inputClass =
  'w-full rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--app-accent)]'

const todayStr = () => new Date().toISOString().slice(0, 10)

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
  const [from, setFrom] = useState(babyBirthDate)
  const [to, setTo] = useState(todayStr)
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
      const fromMs = startOfDayMs(from)
      const toMs = endOfDayMs(to)
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
        <label className="block text-sm">
          <span className="mb-1 block font-medium">From</span>
          <input
            type="date"
            className={inputClass}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">To</span>
          <input
            type="date"
            className={inputClass}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
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
