/**
 * The parts of this canvas that must not drift between artboards.
 *
 * Twenty-one phone artboards share one frame, one nav bar, one tab bar and one
 * icon set, and every colour here is lifted from `apps/mobile/src/theme/tokens.ts`
 * and `@gather/core/module-tints` (light scheme, `home` group — Tasks and Notes
 * are both in it) rather than eyeballed. Each artboard's BODY is hand-written in
 * `_build.mjs`; only the chrome comes from here.
 */

/* ── tokens ──────────────────────────────────────────────────────────── */
export const BG = '#faf9f7'
export const SURFACE = '#ffffff'
export const TILE = '#f1f2f0'
export const FG = '#1f2421'
export const MUTED = '#79807b'
export const BORDER = '#e8e7e3'
export const TINT = '#8a6a33' // MODULE_TINTS.light.home[1]
export const TINT_BG = '#f2ece0' // MODULE_TINTS.light.home[0]
export const DANGER = '#a4372c'
export const DANGER_BG = '#f7ecea'
export const KITCHEN = '#2b7f86'
export const KITCHEN_BG = '#e2f2f0'
export const MONEY = '#2f6a4a'
export const MONEY_BG = '#e4efe6'
export const TASTING = '#7d3f5f'
export const TASTING_BG = '#f0e6ec'

/* ── icons (lucide geometry — the set `theme/icons.ts` draws from) ───── */
export const P = {
  chevronL: '<path d="m15 18-6-6 6-6"></path>',
  chevronR: '<path d="m9 18 6-6-6-6"></path>',
  chevronD: '<path d="m6 9 6 6 6-6"></path>',
  plus: '<path d="M5 12h14"></path><path d="M12 5v14"></path>',
  check: '<path d="M20 6 9 17l-5-5"></path>',
  x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  listChecks:
    '<path d="m3 5 2 2 3-3"></path><path d="m3 13 2 2 3-3"></path><path d="M13 6h8"></path><path d="M13 15h8"></path>',
  calendar:
    '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><path d="M4 22v-7"></path>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.2 8.2a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8z"></path><circle cx="7" cy="7" r="1.3"></circle>',
  trash:
    '<path d="M4 6.5h16"></path><path d="M9.5 6.5V4h5v2.5"></path><path d="m6.5 6.5 1 13.5h9l1-13.5"></path>',
  more: '<circle cx="5" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="19" cy="12" r="1.5"></circle>',
  grip: '<circle cx="9" cy="6" r="1.4"></circle><circle cx="15" cy="6" r="1.4"></circle><circle cx="9" cy="12" r="1.4"></circle><circle cx="15" cy="12" r="1.4"></circle><circle cx="9" cy="18" r="1.4"></circle><circle cx="15" cy="18" r="1.4"></circle>',
  search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>',
  refresh:
    '<path d="M21 12a9 9 0 1 1-2.6-6.4"></path><path d="M21 3.5V9h-5.5"></path>',
  pin: '<path d="M12 17v5"></path><path d="M9.5 2.5h5l-1 6.5 3 3.2V15H7.5v-2.8l3-3.2z"></path>',
  notebookPen:
    '<path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h6"></path><path d="M2 6h2"></path><path d="M2 10h2"></path><path d="M2 14h2"></path><path d="M2 18h2"></path><path d="M21.4 9.6a2 2 0 0 1 0 2.8l-6.3 6.3-3.5.7.7-3.5 6.3-6.3a2 2 0 0 1 2.8 0z"></path>',
  pencil: '<path d="M17 3.5a2.1 2.1 0 0 1 3 3L7.5 19 3 20.5 4.5 16z"></path>',
  bold: '<path d="M6.5 4H13a4 4 0 0 1 0 8H6.5z"></path><path d="M6.5 12h7a4 4 0 0 1 0 8h-7z"></path>',
  bullet:
    '<path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><circle cx="3.6" cy="6" r="1.2"></circle><circle cx="3.6" cy="12" r="1.2"></circle><circle cx="3.6" cy="18" r="1.2"></circle>',
  checkSquare:
    '<rect x="3" y="3" width="18" height="18" rx="3.5"></rect><path d="m8 12 3 3 5-5"></path>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2.5"></rect><circle cx="8.5" cy="9.5" r="1.6"></circle><path d="m4 18 5-5 4 4 3-3 4 4"></path>',
  user: '<circle cx="12" cy="8" r="3.5"></circle><path d="M4.5 20a7.5 7.5 0 0 1 15 0"></path>',
  home: '<path d="M3 10.5 12 3l9 7.5"></path><path d="M5 10v10h14V10"></path>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"></rect><rect x="14" y="3" width="7" height="7" rx="1.6"></rect><rect x="3" y="14" width="7" height="7" rx="1.6"></rect><rect x="14" y="14" width="7" height="7" rx="1.6"></rect>',
  addTab:
    '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path>',
  gear: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3"></path><path d="M12 19v3"></path><path d="M2 12h3"></path><path d="M19 12h3"></path><path d="m4.9 4.9 2.1 2.1"></path><path d="m17 17 2.1 2.1"></path><path d="M19.1 4.9 17 7"></path><path d="M7 17l-2.1 2.1"></path>',
  baby: '<path d="M9 12h.01"></path><path d="M15 12h.01"></path><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"></path><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5S14.5 8 13 8c-1.5 0-2.5-.5-2.5-1.5"></path>',
  chef: '<path d="M6 20.5h12"></path><path d="M7 17.5h10l1-7A4 4 0 0 0 15 6a4 4 0 0 0-6 0 4 4 0 0 0-3 4.5z"></path>',
  clock:
    '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5.2l3.2 1.9"></path>',
  alert:
    '<circle cx="12" cy="12" r="9"></circle><path d="M12 8v5"></path><path d="M12 16h.01"></path>',
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
  </style>
</helmet>
`

/**
 * The real status bar and the real keyboard draw themselves over the app on a
 * phone. Both are left as empty space here rather than painted as fakes.
 */
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
  const on = id === active
  return `    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: ${on ? TINT : MUTED};">${ic(path, { size: 22, color: 'currentColor' })}<span style="font-size: 10px;${on ? ' font-weight: 600;' : ''}">${text}</span></div>`
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
  `  <div style="flex: none; padding: 2px 16px 12px;">
    <div style="font-size: 32px; font-weight: 800; letter-spacing: -0.9px;">${title}</div>${sub ? `
    <div style="font-size: 13.5px; color: ${MUTED}; margin-top: 3px;">${sub}</div>` : ''}
  </div>`

export const label = (text) =>
  `<div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: ${MUTED}; padding-left: 2px;">${text}</div>`

export const card = (inner, extra = '') =>
  `<div style="background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 16px; padding: 0 14px; overflow: hidden;${extra}">${inner}</div>`

export const scroll = (inner, pad = '12px 16px 0', gap = 20) =>
  `  <div style="flex: 1; min-height: 0; overflow: hidden; padding: ${pad}; display: flex; flex-direction: column; gap: ${gap}px;">
${inner}
  </div>`

export const checkbox = (done, tint = TINT) =>
  done
    ? `<div style="width: 21px; height: 21px; border-radius: 6px; border: 1.6px solid ${tint}; background: ${tint}; display: flex; align-items: center; justify-content: center; flex: none;">${ic(P.check, { size: 14, color: SURFACE, sw: 3 })}</div>`
    : `<div style="width: 21px; height: 21px; border-radius: 6px; border: 1.6px solid ${BORDER}; flex: none;"></div>`

export const badge = (text, fg = TINT, bg = TINT_BG) =>
  `<span style="font-size: 11.5px; font-weight: 700; letter-spacing: 0.3px; color: ${fg}; background: ${bg}; border-radius: 8px; padding: 4px 8px; white-space: nowrap;">${text}</span>`

export const chip = (text, on = false, tint = TINT) =>
  `<span style="font-size: 13.5px; font-weight: 600; padding: 7px 13px; border-radius: 999px; white-space: nowrap; ${on ? `background: ${tint}; color: ${SURFACE};` : `background: ${SURFACE}; color: ${FG}; border: 1px solid ${BORDER};`}">${text}</span>`

/** A row inside a card. `last` drops the hairline. */
export const row = (inner, { min = 54, last = false, style = '' } = {}) =>
  `<div style="display: flex; align-items: center; gap: 11px; min-height: ${min}px;${last ? '' : ` border-bottom: 1px solid ${BORDER};`}${style}">${inner}</div>`

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
export const sheet = (inner, onClose = '') =>
  `    <div${onClose ? ` onClick="${onClose}"` : ''} style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(31, 36, 33, 0.34);"></div>
    <div style="position: absolute; left: 0; right: 0; bottom: 0; background: ${SURFACE}; border-radius: 20px 20px 0 0; padding: 12px 16px 30px; display: flex; flex-direction: column; gap: 14px;">
      <div style="width: 38px; height: 4px; border-radius: 2px; background: ${BORDER}; align-self: center;"></div>
${inner}
    </div>`
