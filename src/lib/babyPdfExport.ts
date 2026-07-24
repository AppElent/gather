import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Doc } from '../../convex/_generated/dataModel'
import type { BabyEventType } from '../../convex/lib/babyEvents'
import {
  BABY_EVENT_LABELS,
  BABY_EVENT_TYPES,
} from '../../convex/lib/babyEvents'
import { formatAge } from './babyDate'
import { summarizeEvent } from './babyEventSummary'

export interface BabyPdfExportOptions {
  baby: { name: string; birthDate: string }
  events: Doc<'babyEvents'>[]
  from: number
  to: number
  types?: BabyEventType[]
}

const PAGE_BOTTOM_MARGIN = 270

/** Client-side PDF export (no server-side PDF capability on this stack —
 * see the Baby log module plan). One table per included event category,
 * chronological within each. */
export function exportBabyLogPdf({
  baby,
  events,
  from,
  to,
  types,
}: BabyPdfExportOptions) {
  const included = types ?? [...BABY_EVENT_TYPES]
  const doc = new jsPDF()

  doc.setFontSize(16)
  doc.text(`${baby.name} — baby log`, 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(90)
  doc.text(
    `Born ${new Date(`${baby.birthDate}T00:00:00`).toLocaleDateString()} · ${formatAge(baby.birthDate, to)}`,
    14,
    25,
  )
  doc.text(
    `${new Date(from).toLocaleDateString()} – ${new Date(to).toLocaleDateString()}`,
    14,
    31,
  )
  doc.setTextColor(0)

  let cursorY = 40
  let printedAny = false

  for (const type of included) {
    const rows = events
      .filter((e) => e.type === type)
      .sort((a, b) => a.timestamp - b.timestamp)
    if (rows.length === 0) continue
    printedAny = true

    if (cursorY > PAGE_BOTTOM_MARGIN) {
      doc.addPage()
      cursorY = 20
    }

    doc.setFontSize(12)
    doc.text(BABY_EVENT_LABELS[type], 14, cursorY)

    autoTable(doc, {
      startY: cursorY + 3,
      head: [['Date', 'Time', 'Details', 'Notes']],
      body: rows.map((e) => {
        const d = new Date(e.timestamp)
        return [
          d.toLocaleDateString(),
          d.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          }),
          summarizeEvent(e),
          e.notes ?? '',
        ]
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [70, 130, 140] },
      margin: { left: 14, right: 14 },
    })

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable?.finalY
    cursorY = (finalY ?? cursorY + 10) + 12
  }

  if (!printedAny) {
    doc.setFontSize(11)
    doc.text('No entries in this date range.', 14, cursorY)
  }

  const dateStamp = new Date(to).toISOString().slice(0, 10)
  const safeName = baby.name.trim().replace(/\s+/g, '-').toLowerCase() || 'baby'
  doc.save(`${safeName}-log-${dateStamp}.pdf`)
}
