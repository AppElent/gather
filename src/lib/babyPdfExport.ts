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

export type BabyPdfLayout = 'category' | 'chronological'

export interface BabyPdfExportOptions {
  baby: { name: string; birthDate: string }
  events: Doc<'babyEvents'>[]
  from: number
  to: number
  types?: BabyEventType[]
  /** 'category' (default): one table per event type. 'chronological': a single
   * table in time order, entries logged in the same minute merged into one row. */
  layout?: BabyPdfLayout
}

export interface MinuteGroup {
  minuteMs: number
  events: Doc<'babyEvents'>[]
}

const PAGE_BOTTOM_MARGIN = 270
const TABLE_STYLES = {
  styles: { fontSize: 9 },
  headStyles: { fillColor: [70, 130, 140] as [number, number, number] },
  margin: { left: 14, right: 14 },
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString()
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Chronological events bucketed by the minute they were logged in — entries
 * saved together by the multi-entry form share a timestamp and so land in one
 * bucket. */
export function groupEventsByMinute(
  events: Doc<'babyEvents'>[],
  types?: BabyEventType[],
): MinuteGroup[] {
  const included = new Set(types ?? BABY_EVENT_TYPES)
  const groups = new Map<number, MinuteGroup>()
  for (const event of events) {
    if (!included.has(event.type)) continue
    const minuteMs = Math.floor(event.timestamp / 60000) * 60000
    const group = groups.get(minuteMs)
    if (group) group.events.push(event)
    else groups.set(minuteMs, { minuteMs, events: [event] })
  }
  return Array.from(groups.values())
    .sort((a, b) => a.minuteMs - b.minuteMs)
    .map((group) => ({
      minuteMs: group.minuteMs,
      events: [...group.events].sort((a, b) => a.timestamp - b.timestamp),
    }))
}

function drawHeader(
  doc: jsPDF,
  baby: { name: string; birthDate: string },
  from: number,
  to: number,
) {
  doc.setFontSize(16)
  doc.text(`${baby.name} — baby log`, 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(90)
  doc.text(
    `Born ${new Date(`${baby.birthDate}T00:00:00`).toLocaleDateString()} · ${formatAge(baby.birthDate, to)}`,
    14,
    25,
  )
  doc.text(`${formatDate(from)} – ${formatDate(to)}`, 14, 31)
  doc.setTextColor(0)
}

/** One table per event type, chronological within each. */
function drawByCategory(
  doc: jsPDF,
  events: Doc<'babyEvents'>[],
  included: BabyEventType[],
): boolean {
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
      body: rows.map((e) => [
        formatDate(e.timestamp),
        formatTime(e.timestamp),
        summarizeEvent(e),
        e.notes ?? '',
      ]),
      ...TABLE_STYLES,
    })

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable?.finalY
    cursorY = (finalY ?? cursorY + 10) + 12
  }

  return printedAny
}

/** A single time-ordered table, one row per minute — everything logged in the
 * same minute (a diaper check, a temperature and a feed) reads as one line. */
function drawChronological(
  doc: jsPDF,
  events: Doc<'babyEvents'>[],
  included: BabyEventType[],
): boolean {
  const groups = groupEventsByMinute(events, included)
  if (groups.length === 0) return false

  autoTable(doc, {
    startY: 40,
    head: [['Date', 'Time', 'Entries', 'Notes']],
    body: groups.map((group) => [
      formatDate(group.minuteMs),
      formatTime(group.minuteMs),
      group.events
        .map((e) => `${BABY_EVENT_LABELS[e.type]}: ${summarizeEvent(e)}`)
        .join('\n'),
      group.events
        .filter((e) => e.notes)
        .map((e) =>
          // Only worth labelling whose note it is when the row holds several.
          group.events.length > 1
            ? `${BABY_EVENT_LABELS[e.type]}: ${e.notes}`
            : e.notes,
        )
        .join('\n'),
    ]),
    ...TABLE_STYLES,
  })

  return true
}

/** Client-side PDF export (no server-side PDF capability on this stack —
 * see the Baby log module plan). */
export function exportBabyLogPdf({
  baby,
  events,
  from,
  to,
  types,
  layout = 'category',
}: BabyPdfExportOptions) {
  const included = types ?? [...BABY_EVENT_TYPES]
  const doc = new jsPDF()

  drawHeader(doc, baby, from, to)

  const printedAny =
    layout === 'chronological'
      ? drawChronological(doc, events, included)
      : drawByCategory(doc, events, included)

  if (!printedAny) {
    doc.setFontSize(11)
    doc.text('No entries in this date range.', 14, 40)
  }

  const dateStamp = new Date(to).toISOString().slice(0, 10)
  const safeName = baby.name.trim().replace(/\s+/g, '-').toLowerCase() || 'baby'
  doc.save(`${safeName}-log-${dateStamp}.pdf`)
}
