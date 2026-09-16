/**
 * The parts of this canvas that must not drift between artboards.
 *
 * Nine phone artboards share one frame, one nav bar, one tab bar, one icon set
 * and ONE MONTH OF FIXTURE DATA. Every colour is lifted from
 * `apps/mobile/src/theme/tokens.ts` and `@gather/core/module-tints` (light
 * scheme, `home` group — Calendar is in it) rather than eyeballed, and the
 * month grid below is `monthGrid()` from
 * `apps/mobile/src/modules/tasks/taskDates.ts` transcribed rather than
 * re-derived: Monday first, always six rows, never `toISOString()`.
 */

/* ── tokens (theme/tokens.ts, light) ─────────────────────────────────── */
export const BG = '#faf9f7'
export const SURFACE = '#ffffff'
export const TILE = '#f1f2f0'
export const FG = '#1f2421'
export const MUTED = '#79807b'
export const BORDER = '#e8e7e3'
export const TINT = '#8a6a33' // MODULE_TINTS.light.home[1]
export const TINT_BG = '#f2ece0' // MODULE_TINTS.light.home[0]
export const DANGER = '#a4372c'

/* ── the calendars ───────────────────────────────────────────────────────
 * `calendars` has no `color` column today. These names are the Module tints
 * from `@gather/core/module-tints`, which is the proposal: a calendar's
 * colour is a TOKEN NAME, not a hex somebody picked off a wheel.
 */
export const CAL = {
  house: { name: 'Household', fg: '#8a6a33', bg: '#f2ece0' },
  school: { name: 'School', fg: '#2b7f86', bg: '#e2f2f0' },
  work: { name: 'Work', fg: '#7d3f5f', bg: '#f0e6ec' },
}

/* `groups.members` returns a name and a standing and nothing else — no image
 * field — so a person is an INITIAL, never an avatar. */
export const MEM = { E: 'Eric', S: 'Sanne', M: 'Mila' }

/* ── the month ───────────────────────────────────────────────────────────
 * September 2026. Today is Wednesday the 2nd. It contains an all-day event,
 * a timed event, a day with two events, and one completely empty week (7–13).
 */
export const TODAY = '2026-09-02'
export const YEAR = 2026
export const MONTH = 8 // zero-based, as `monthGrid` takes it

export const EVENTS = [
  { date: '2026-09-01', title: 'First day of school', cal: 'school', allDay: true, who: ['M'] },
  { date: '2026-09-02', title: 'Dentist — Mila', cal: 'house', start: '14:30', end: '15:15', who: ['S', 'M'] },
  { date: '2026-09-03', title: 'Parents’ evening', cal: 'school', start: '19:30', end: '21:00', who: ['E', 'S'] },
  { date: '2026-09-04', title: 'Bins out', cal: 'house', allDay: true, who: ['E'] },
  { date: '2026-09-04', title: 'Swimming lesson', cal: 'school', start: '16:00', end: '16:45', who: ['M'] },
  { date: '2026-09-14', title: 'Sanne away — Berlin', cal: 'house', allDay: true, who: ['S'] },
  { date: '2026-09-19', title: 'Grandad’s birthday', cal: 'house', start: '15:00', who: ['E', 'S', 'M'] },
  { date: '2026-09-23', title: 'Report meeting', cal: 'school', start: '17:00', end: '17:20', who: ['E'] },
  { date: '2026-09-26', title: 'Big shop', cal: 'house', allDay: true, who: ['E'] },
]

/** The same month for a household that actually uses it — the confetti test. */
export const BUSY = [
  ...EVENTS,
  { date: '2026-09-01', title: 'Standup', cal: 'work', start: '09:30', end: '09:45', who: ['E'] },
  { date: '2026-09-02', title: 'Physio', cal: 'work', start: '08:00', end: '08:45', who: ['S'] },
  { date: '2026-09-02', title: 'Football training', cal: 'school', start: '18:00', end: '19:30', who: ['M'] },
  { date: '2026-09-03', title: 'Bins out', cal: 'house', allDay: true, who: ['E'] },
  { date: '2026-09-07', title: 'Sprint planning', cal: 'work', start: '10:00', end: '11:30', who: ['E'] },
  { date: '2026-09-08', title: 'Swimming lesson', cal: 'school', start: '16:00', end: '16:45', who: ['M'] },
  { date: '2026-09-09', title: 'Book club', cal: 'work', start: '20:00', who: ['S'] },
  { date: '2026-09-10', title: 'Boiler service', cal: 'house', start: '11:00', end: '13:00', who: ['S'] },
  { date: '2026-09-11', title: 'Cinema', cal: 'house', start: '19:45', who: ['E', 'S'] },
  { date: '2026-09-15', title: 'Swimming lesson', cal: 'school', start: '16:00', end: '16:45', who: ['M'] },
  { date: '2026-09-16', title: 'Dentist — Eric', cal: 'house', start: '09:15', end: '09:45', who: ['E'] },
  { date: '2026-09-17', title: 'Team offsite', cal: 'work', allDay: true, who: ['E'] },
  { date: '2026-09-18', title: 'School photos', cal: 'school', allDay: true, who: ['M'] },
  { date: '2026-09-22', title: 'Swimming lesson', cal: 'school', start: '16:00', end: '16:45', who: ['M'] },
  { date: '2026-09-24', title: 'Bins out', cal: 'house', allDay: true, who: ['S'] },
  { date: '2026-09-25', title: 'Drinks with Joris', cal: 'work', start: '18:30', who: ['E'] },
  { date: '2026-09-29', title: 'Swimming lesson', cal: 'school', start: '16:00', end: '16:45', who: ['M'] },
  { date: '2026-09-30', title: 'Quarter review', cal: 'work', start: '13:00', end: '15:00', who: ['E'] },
]

/* ── date primitives (taskDates.ts, transcribed) ─────────────────────── */
export const parseDay = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const toIso = (date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`

/** Six rows of seven, Monday first, `null` outside the month. */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const weeks = []
  let day = 1 - lead
  for (let w = 0; w < 6; w++) {
    const line = []
    for (let c = 0; c < 7; c++, day++) {
      line.push(day >= 1 && day <= days ? toIso(new Date(year, month, day)) : null)
    }
    weeks.push(line)
  }
  return { first, weeks }
}

export const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
export const dayName = (iso, long = false) =>
  parseDay(iso).toLocaleDateString('en-GB', { weekday: long ? 'long' : 'short' })
export const dayNum = (iso) => parseDay(iso).getDate()
export const longDate = (iso) =>
  parseDay(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
export const shortDate = (iso) =>
  parseDay(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
export const on = (iso, set = EVENTS) => set.filter((e) => e.date === iso)

/* ── icons (lucide geometry — the set `theme/icons.ts` draws from) ───── */
export const P = {
  chevronL: '<path d="m15 18-6-6 6-6"></path>',
  chevronR: '<path d="m9 18 6-6-6-6"></path>',
  chevronD: '<path d="m6 9 6 6 6-6"></path>',
  chevronU: '<path d="m18 15-6-6-6 6"></path>',
  plus: '<path d="M5 12h14"></path><path d="M12 5v14"></path>',
  check: '<path d="M20 6 9 17l-5-5"></path>',
  x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  calendar:
    '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5.2l3.2 1.9"></path>',
  user: '<circle cx="12" cy="8" r="3.5"></circle><path d="M4.5 20a7.5 7.5 0 0 1 15 0"></path>',
  users:
    '<circle cx="9" cy="8" r="3.2"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.6"></path><path d="M18 14.4a6.5 6.5 0 0 1 3.5 5.6"></path>',
  pin: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"></path><circle cx="12" cy="10" r="2.6"></circle>',
  notebookPen:
    '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6"></path><path d="M2 6h2"></path><path d="M2 10h2"></path><path d="M2 14h2"></path><path d="M2 18h2"></path><path d="M21.4 9.6a2 2 0 0 1 0 2.8l-6.3 6.3-3.5.7.7-3.5 6.3-6.3a2 2 0 0 1 2.8 0z"></path>',
  more: '<circle cx="5" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>',
  search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>',
  home: '<path d="M3 10.5 12 3l9 7.5"></path><path d="M5 10v10h14V10"></path>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"></rect><rect x="14" y="3" width="7" height="7" rx="1.6"></rect><rect x="3" y="14" width="7" height="7" rx="1.6"></rect><rect x="14" y="14" width="7" height="7" rx="1.6"></rect>',
  addTab: '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path>',
  moreCircle: '<circle cx="12" cy="12" r="9.2"></circle><circle cx="7.6" cy="12" r="1.15" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"></circle><circle cx="16.4" cy="12" r="1.15" fill="currentColor" stroke="none"></circle>',
  trash: '<path d="M4 6.5h16"></path><path d="M9.5 6.5V4h5v2.5"></path><path d="m6.5 6.5 1 13.5h9l1-13.5"></path>',
  arrowUp: '<path d="M12 19V5"></path><path d="m5.5 11.5 6.5-6.5 6.5 6.5"></path>',
  gear: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3"></path><path d="M12 19v3"></path><path d="M2 12h3"></path><path d="M19 12h3"></path><path d="m4.9 4.9 2.1 2.1"></path><path d="m17 17 2.1 2.1"></path><path d="M19.1 4.9 17 7"></path><path d="M7 17l-2.1 2.1"></path>',
}

export const ic = (d, o = {}) =>
  `<svg class="ic" width="${o.size ?? 20}" height="${o.size ?? 20}" viewBox="0 0 24 24" fill="none" stroke="${o.color ?? MUTED}" stroke-width="${o.sw ?? 1.9}" stroke-linecap="round" stroke-linejoin="round"${o.style ? ` style="${o.style}"` : ''}>${d}</svg>`

/* ── frame ───────────────────────────────────────────────────────────── */
const HEAD = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    body { margin: 0; font-family: -apple-system, "SF Pro Text", system-ui, "Segoe UI", Roboto, sans-serif; }
    a { color: ${TINT}; text-decoration: none; }
    a:hover { color: #6d5327; }
    .ic { flex: none; }
    input.f { font: inherit; border: 0; outline: 0; background: transparent; color: ${FG}; width: 100%; padding: 0; }
    input.f::placeholder { color: ${MUTED}; }
  </style>
</helmet>
`

/** The real status bar and the real keyboard draw themselves on a phone. */
export const STATUS = '  <div style="height: 47px; flex: none;"></div>'
export const HOME_BAR = (bg = 'transparent') =>
  `  <div style="height: 34px; flex: none; background: ${bg};"></div>`

const TABS = [
  ['home', 'Home', P.home],
  ['search', 'Search', P.search],
  ['add', 'Add', P.addTab],
  ['settings', 'Settings', P.gear],
  ['all', 'All', P.grid],
]

export const tabBar = (active = 'all') =>
  `  <div style="flex: none; display: flex; height: 49px; background: ${SURFACE}; border-top: 1px solid ${BORDER};">
${TABS.map(([id, text, path]) => {
  const isOn = id === active
  return `    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: ${isOn ? TINT : MUTED};">${ic(path, { size: 22, color: 'currentColor' })}<span style="font-size: 10px;${isOn ? ' font-weight: 600;' : ''}">${text}</span></div>`
}).join('\n')}
  </div>`

export const navBar = (back, title, right = '') =>
  `  <div style="flex: none; display: flex; align-items: center; height: 52px; padding: 0 16px 0 8px; gap: 8px;">
    <div style="flex: 1; display: flex; align-items: center; gap: 1px; color: ${TINT}; cursor: pointer; min-width: 0;">${ic(P.chevronL, { size: 22, color: TINT, sw: 2 })}<span style="font-size: 17px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${back}</span></div>
    <div style="font-size: 17px; font-weight: 700; letter-spacing: -0.3px; white-space: nowrap;">${title}</div>
    <div style="flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 17px;">${right}</div>
  </div>`

/** The back row above a large title — an index screen pushed from All. */
export const topActions = (right = '', back = 'All') =>
  `  <div style="flex: none; display: flex; align-items: center; justify-content: space-between; height: 44px; padding: 0 16px 0 6px;">
    <div style="display: flex; align-items: center; gap: 2px; color: ${TINT}; cursor: pointer;">${ic(P.chevronL, { size: 22, color: TINT, sw: 2 })}<span style="font-size: 17px;">${back}</span></div>
    <div style="display: flex; align-items: center; gap: 18px;">${right}</div>
  </div>`

export const bigTitle = (title, sub) =>
  `  <div style="flex: none; padding: 2px 16px 10px;">
    <div style="font-size: 32px; font-weight: 800; letter-spacing: -0.9px;">${title}</div>${sub ? `
    <div style="font-size: 13.5px; color: ${MUTED}; margin-top: 3px;">${sub}</div>` : ''}
  </div>`

export const label = (text) =>
  `<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: ${MUTED}; padding-left: 2px;">${text}</div>`

export const card = (inner, extra = '') =>
  `<div style="background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 16px; padding: 0 14px; overflow: hidden;${extra}">${inner}</div>`

export const row = (inner, { min = 54, last = false, style = '' } = {}) =>
  `<div style="display: flex; align-items: center; gap: 11px; min-height: ${min}px;${last ? '' : ` border-bottom: 1px solid ${BORDER};`}${style}">${inner}</div>`

export const chip = (text, isOn = false, tint = TINT) =>
  `<span style="font-size: 13.5px; font-weight: 600; padding: 7px 13px; border-radius: 999px; white-space: nowrap; ${isOn ? `background: ${tint}; color: ${SURFACE};` : `background: ${SURFACE}; color: ${FG}; border: 1px solid ${BORDER};`}">${text}</span>`

/* ── calendar-specific pieces ────────────────────────────────────────── */

/** A person. An initial in a circle, because `groups.members` has no image. */
export const who = (key, { size = 20, tint = MUTED } = {}) =>
  `<span style="width: ${size}px; height: ${size}px; border-radius: 999px; background: ${SURFACE}; border: 1.4px solid ${tint}; color: ${tint}; font-size: ${Math.round(size * 0.5)}px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none;">${key}</span>`

export const whoRow = (keys, o = {}) =>
  `<span style="display: inline-flex; align-items: center; gap: 3px; flex: none;">${keys.map((k) => who(k, o)).join('')}</span>`

export const dot = (cal, size = 6) =>
  `<span style="width: ${size}px; height: ${size}px; border-radius: 999px; background: ${CAL[cal].fg}; flex: none;"></span>`

export const timeOf = (e) => (e.allDay ? 'all-day' : e.end ? `${e.start}–${e.end}` : e.start)

/** The weekday strip a Monday-first grid needs. */
export const weekdayStrip = (pad = '0 10px') =>
  `<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding: ${pad}; flex: none;">${WEEKDAYS.map(
    (d) =>
      `<div style="text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: ${MUTED}; padding: 4px 0 6px;">${d}</div>`,
  ).join('')}</div>`

export const monthBar = (text, right = '') =>
  `  <div style="flex: none; display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 16px;">
    <div style="cursor: pointer;">${ic(P.chevronL, { size: 20, color: TINT, sw: 2.2 })}</div>
    <div style="font-size: 17px; font-weight: 700; letter-spacing: -0.3px;">${text}</div>
    <div style="cursor: pointer;">${ic(P.chevronR, { size: 20, color: TINT, sw: 2.2 })}</div>
    <div style="flex: 1;"></div>${right}
  </div>`

export const STATIC = `class Component extends DCLogic {
  renderVals() {
    return {};
  }
}`

export const page = (inner, script = STATIC, bg = BG) => `${HEAD}
<div style="position: relative; width: 390px; height: 844px; overflow: hidden; background: ${bg}; color: ${FG}; display: flex; flex-direction: column;">

${inner}

</div>
</x-dc>
<script data-dc-script data-props='{"$preview":{"width":390,"height":844}}'>
${script}
</script>
</body>
</html>
`

/** The dimmed backdrop + native sheet a `@expo/ui` BottomSheetModal presents. */
export const sheet = (inner, { onClose = '', pad = '12px 16px 30px' } = {}) =>
  `    <div${onClose ? ` onClick="${onClose}"` : ''} style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(31, 36, 33, 0.34);"></div>
    <div style="position: absolute; left: 0; right: 0; bottom: 0; background: ${SURFACE}; border-radius: 20px 20px 0 0; padding: ${pad}; display: flex; flex-direction: column; gap: 14px;">
      <div style="width: 38px; height: 4px; border-radius: 2px; background: ${BORDER}; align-self: center;"></div>
${inner}
    </div>`

/* ── the mix's own fixture ───────────────────────────────────────────────
 * Same month, plus the case the direction row never showed: an event with
 * NOBODY on it. `calendarEvents` has no assignee column today, so on the day
 * this ships every event is one of these — which is exactly why the winning
 * cell needs an answer for it.
 */
export const MIX_EVENTS = EVENTS.map((e) =>
  e.title === 'Bins out' || e.title === 'Big shop' ? { ...e, who: [] } : e,
)
