/**
 * Every prototype this app carries, one entry each.
 *
 * The rule that makes the section survive: **winning a variant does not delete
 * the prototype.** The winner is folded into the real code as normal and the
 * entry stays here with its verdict written down, because seeing the
 * alternatives side by side a year later is the entire point of keeping them.
 *
 * The cost of that is obvious and accepted — Labs accumulates. The dated
 * question and the recorded verdict are what keep it readable; if it ever gets
 * long enough to be noise that is the signal to prune, not to abandon it.
 *
 * A row is a `SettingsHref` plus params rather than a free string, so a
 * prototype whose route was deleted fails `pnpm typecheck` instead of becoming
 * a dead link somebody finds in six months.
 */
import type { SettingsHref } from '../settings/sections'

export interface LabsLink {
  /** The combination this link opens — `nav=fluid`, and so on. */
  params: Record<string, string>
}

export interface LabsEntry {
  id: 'calendar'
  href: Extract<SettingsHref, `/settings/labs/${string}`>
  /** ISO date, so a reader can see how stale the question is. */
  built: string
  /**
   * The interesting combinations, offered as links so a person does not have
   * to find them with the switcher. The first is always the canvas verdict.
   */
  links: LabsLink[]
  /**
   * Whether a verdict exists. `null` while the prototype is still being lived
   * with — which is not the same as nobody having looked at it.
   *
   * A flag rather than the sentence, because the sentence is user-visible and
   * user-visible strings live in the message tree in both locales (ADR-0011).
   * `t.labs[entry.id].verdict` is where the words are.
   */
  verdict: 'settled' | null
}

export const LABS_ENTRIES: LabsEntry[] = [
  {
    id: 'calendar',
    href: '/settings/labs/calendar',
    built: '2026-09-02',
    links: [
      { params: { nav: 'menu', cell: 'marks', composer: 'card' } },
      { params: { nav: 'fluid', cell: 'marks', composer: 'card' } },
      { params: { nav: 'segmented', cell: 'bars', composer: 'sheet' } },
      { params: { nav: 'menu', cell: 'bars', composer: 'inline' } },
    ],
    verdict: 'settled',
  },
]
