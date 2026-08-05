import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Doc } from '../../convex/_generated/dataModel'
import type { BabyEventType } from '../../convex/lib/babyEvents'
import { BABY_EVENT_TYPES } from '../../convex/lib/babyEvents'
import { formatAge } from './babyDate'
import type { BabySummaryMessages } from './babyEventSummary'
import { summarizeEvent } from './babyEventSummary'
import { fmt } from './i18n'

export type BabyPdfLayout = 'category' | 'chronological'

export interface BabyPdfExportOptions {
  baby: { name: string; birthDate: string }
  /** The Baby log's words, and the locale to format dates in (ADR-0011). */
  messages: BabySummaryMessages
  eventTypes: Record<BabyEventType, string>
  locale: string
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
  m: BabySummaryMessages,
  locale: string,
) {
  doc.setFontSize(16)
  doc.text(fmt(m.pdf.title, { name: baby.name }), 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(90)
  doc.text(
    fmt(m.pdf.born, {
      date: new Date(`${baby.birthDate}T00:00:00`).toLocaleDateString(locale),
      age: formatAge(baby.birthDate, m.child.age, locale, to),
    }),
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
  m: BabySummaryMessages,
  eventTypes: Record<BabyEventType, string>,
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
    doc.text(eventTypes[type], 14, cursorY)

    autoTable(doc, {
      startY: cursorY + 3,
      head: [
        [
          m.pdf.columnDate,
          m.pdf.columnTime,
          m.pdf.columnDetails,
          m.pdf.columnNotes,
        ],
      ],
      body: rows.map((e) => [
        formatDate(e.timestamp),
        formatTime(e.timestamp),
        summarizeEvent(e, m),
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
  m: BabySummaryMessages,
  eventTypes: Record<BabyEventType, string>,
): boolean {
  const groups = groupEventsByMinute(events, included)
  if (groups.length === 0) return false

  autoTable(doc, {
    startY: 40,
    head: [
      [
        m.pdf.columnDate,
        m.pdf.columnTime,
        m.pdf.columnEntries,
        m.pdf.columnNotes,
      ],
    ],
    body: groups.map((group) => [
      formatDate(group.minuteMs),
      formatTime(group.minuteMs),
      group.events
        .map((e) => `${eventTypes[e.type]}: ${summarizeEvent(e, m)}`)
        .join('\n'),
      group.events
        .filter((e) => e.notes)
        .map((e) =>
          // Only worth labelling whose note it is when the row holds several.
          group.events.length > 1
            ? `${eventTypes[e.type]}: ${e.notes}`
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
  messages: m,
  eventTypes,
  locale,
  events,
  from,
  to,
  types,
  layout = 'category',
}: BabyPdfExportOptions) {
  const included = types ?? [...BABY_EVENT_TYPES]
  const doc = new jsPDF()

  drawHeader(doc, baby, from, to, m, locale)

  const printedAny =
    layout === 'chronological'
      ? drawChronological(doc, events, included, m, eventTypes)
      : drawByCategory(doc, events, included, m, eventTypes)

  if (!printedAny) {
    doc.setFontSize(11)
    doc.text(m.pdf.empty, 14, 40)
  }

  const dateStamp = new Date(to).toISOString().slice(0, 10)
  const safeName =
    baby.name.trim().replace(/\s+/g, '-').toLowerCase() ||
    m.pdf.fileNameFallback
  doc.save(`${safeName}-log-${dateStamp}.pdf`)
}
