/** One list, whole — THE MIX, directions A/B/C, and reorder mode. */
import {
  BORDER, DANGER, DANGER_BG, FG, HOME_BAR, MUTED, P, STATIC, STATUS, SURFACE,
  TILE, TINT, TINT_BG, badge, card, checkbox, ic, label, navBar, page, row,
  scroll, tabBar,
} from './_kit.mjs'

const screens = {}

const composer = (text = 'Add a task…', last = true) =>
  row(
    `${ic(P.plus, { size: 17, color: TINT, sw: 2.2 })}<span style="flex: 1; font-size: 15.5px; color: ${MUTED};">${text}</span>`,
    { min: 50, last },
  )

/* ── A — The Checklist, adopted ──────────────────────────────────────── */
const plainRow = (title, last = false) =>
  row(
    `${checkbox(false)}<span style="flex: 1; font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</span>`,
    { min: 50, last },
  )

screens['ListA.dc.html'] = page(
  `${STATUS}
${navBar('Tasks', 'Household', ic(P.more, { size: 22, color: TINT }))}
${scroll(
  `    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('HOUSEHOLD')}
      ${card(
        [
          'Call the plumber about the radiator',
          'Pick up the parcel from the DHL point',
          "Renew Emma's passport",
          'Book the MOT',
          'Water the plants on the landing',
          'Ask the neighbours about the fence',
          'Sort the loft boxes',
        ]
          .map((t) => plainRow(t))
          .join('\n      ') +
          `\n      <div style="display: flex; align-items: center; justify-content: space-between; min-height: 48px; border-top: 1px solid ${BORDER};"><span style="font-size: 15px; font-weight: 600; color: ${MUTED};">Completed (2)</span>${ic(P.chevronD, { size: 18, color: MUTED })}</div>
      ${composer()}`,
      )}
    </div>`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

/* ── B — Rich rows ───────────────────────────────────────────────────── */
const pri = (n) =>
  n
    ? `<span style="display: flex; align-items: center; gap: 3px; font-size: 11.5px; font-weight: 800; color: ${n === 1 ? DANGER : n === 2 ? '#b4791f' : MUTED};">${ic(P.flag, { size: 12, color: 'currentColor', sw: 2.4 })}P${n}</span>`
    : ''

const tagChip = (t) =>
  `<span style="font-size: 11px; font-weight: 700; color: ${MUTED}; background: ${TILE}; border-radius: 6px; padding: 3px 7px;">${t}</span>`

const richRow = (title, { due, red, p, tags = [], last = false } = {}) =>
  `      <div style="display: flex; align-items: stretch; gap: 0; min-height: 66px;${last ? '' : ` border-bottom: 1px solid ${BORDER};`}">
        <div style="width: 3px; border-radius: 2px; margin: 12px 11px 12px 0; background: ${p === 1 ? DANGER : p === 2 ? '#e0c48a' : 'transparent'};"></div>
        <div style="display: flex; align-items: center; gap: 11px; flex: 1; min-width: 0;">
          ${checkbox(false)}
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px;">
            <span style="font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</span>
            <div style="display: flex; align-items: center; gap: 7px;">${due ? `<span style="display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: ${red ? DANGER : MUTED};">${ic(P.calendar, { size: 12, color: 'currentColor', sw: 2.2 })}${due}</span>` : ''}${pri(p)}${tags.map(tagChip).join('')}</div>
          </div>
        </div>
      </div>`

screens['ListB.dc.html'] = page(
  `${STATUS}
${navBar('Tasks', 'Household', ic(P.more, { size: 22, color: TINT }))}
${scroll(
  `    ${card(
    [
      richRow('Call the plumber about the radiator', { due: 'Tue', red: true, p: 1, tags: ['house'] }),
      richRow('Pick up the parcel from the DHL point', { due: 'Today' }),
      richRow("Renew Emma's passport", { due: '4 Sep', p: 2, tags: ['admin'] }),
      richRow('Book the MOT', { tags: ['car'] }),
    ].join('\n') + `\n      ${composer()}`,
  )}

    <div style="display: flex; align-items: stretch; border-radius: 16px; overflow: hidden; border: 1px solid ${BORDER};">
      <div style="flex: 1; background: ${SURFACE}; display: flex; align-items: center; gap: 11px; padding: 0 0 0 14px; min-height: 66px; transform: translateX(-6px);">
        ${checkbox(false)}
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px;">
          <span style="font-size: 15.5px;">Water the plants on the landing</span>
          <div style="display: flex; gap: 7px;">${tagChip('house')}</div>
        </div>
      </div>
      <div style="width: 86px; background: ${DANGER}; color: ${SURFACE}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;">
        ${ic(P.trash, { size: 19, color: SURFACE, sw: 2 })}<span style="font-size: 12px; font-weight: 700;">Delete</span>
      </div>
    </div>
    <div style="font-size: 12.5px; line-height: 18px; color: ${MUTED}; padding: 0 2px; margin-top: -8px;">Swipe left reveals Delete, which you then tap — a full swipe never fires it. Swipe right completes.</div>`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

/* ── C — Grouped by when ─────────────────────────────────────────────── */
const dateRow = (title, meta, red = false, last = false) =>
  `        <div style="display: flex; align-items: center; gap: 11px; min-height: 54px;${last ? '' : ` border-bottom: 1px solid ${BORDER};`}">${checkbox(false)}<span style="flex: 1; font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</span><span style="font-size: 12.5px; font-weight: 700; color: ${red ? DANGER : MUTED}; white-space: nowrap;">${meta}</span></div>`

screens['ListC.dc.html'] = page(
  `${STATUS}
${navBar('Tasks', 'Household', ic(P.more, { size: 22, color: TINT }))}
${scroll(
  `    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: ${DANGER}; padding-left: 2px;">OVERDUE</div>
      ${card('\n' + dateRow('Call the plumber about the radiator', 'Tue', true, true) + '\n      ')}
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('TODAY')}
      ${card('\n' + dateRow('Pick up the parcel from the DHL point', '', false, true) + '\n      ')}
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('THIS WEEK')}
      ${card('\n' + dateRow('Book the MOT', 'Thu') + '\n' + dateRow("Renew Emma's passport", 'Fri', false, true) + '\n      ')}
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('NO DATE  ·  4')}
      ${card(
        '\n' +
          dateRow('Water the plants on the landing', '') +
          '\n' +
          dateRow('Ask the neighbours about the fence', '') +
          '\n' +
          dateRow('Sort the loft boxes', '', false, true) +
          '\n      ',
      )}
    </div>`,
)}
  <div style="flex: none; padding: 8px 16px 10px; background: ${BORDER === '' ? SURFACE : 'rgba(250,249,247,0.94)'}; border-top: 1px solid ${BORDER};">
    <div style="display: flex; align-items: center; gap: 10px; background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 12px; padding: 0 13px; min-height: 46px;">
      ${ic(P.plus, { size: 18, color: TINT, sw: 2.2 })}<span style="flex: 1; font-size: 15.5px; color: ${MUTED};">Add a task…</span>
    </div>
  </div>
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

/* ── Reorder mode ────────────────────────────────────────────────────── */
/* Rich rows keep their properties in this mode — you rearrange by recognising
   the row, and stripping it back to the title is what makes that harder. */
const dragRow = (title, meta = '', last = false) =>
  row(
    `${ic(P.grip, { size: 20, color: '#b9beba' })}<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px;"><span style="font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</span>${meta ? `<span style="font-size: 12px; font-weight: 700; color: ${MUTED};">${meta}</span>` : ''}</div>`,
    { min: meta ? 62 : 52, last },
  )

screens['ListReorder.dc.html'] = page(
  `${STATUS}
  <div style="flex: none; display: flex; align-items: center; height: 52px; padding: 0 16px; gap: 8px;">
    <div style="flex: 1;"></div>
    <div style="font-size: 17px; font-weight: 700; letter-spacing: -0.3px;">Household</div>
    <div style="flex: 1; display: flex; justify-content: flex-end;"><span style="font-size: 17px; font-weight: 700; color: ${TINT};">Done</span></div>
  </div>
${scroll(
  `    <div style="display: flex; gap: 9px; padding: 10px 12px; background: ${TINT_BG}; border-radius: 12px;">
      ${ic(P.grip, { size: 17, color: TINT, style: 'margin-top: 1px;' })}<span style="flex: 1; font-size: 13px; line-height: 19px; color: ${TINT};">Drag to rearrange. Completing, editing and swiping are off until you tap Done.</span>
    </div>
    ${card(
      [
        ['Call the plumber about the radiator', 'Tue · P1'],
        ['Pick up the parcel from the DHL point', 'Today'],
        ['Renew Emma’s passport', '4 Sep · P2'],
        ['Book the MOT', 'car'],
      ]
        .map(([t, m]) => dragRow(t, m))
        .join('\n      ') +
        `\n      <div style="display: flex; align-items: center; gap: 11px; min-height: 52px; border-bottom: 1px solid ${BORDER}; background: ${TILE}; margin: 0 -14px; padding: 0 14px; box-shadow: 0 6px 16px rgba(31,36,33,0.12);">${ic(P.grip, { size: 20, color: TINT })}<span style="flex: 1; font-size: 15.5px; font-weight: 600;">Water the plants on the landing</span></div>
      ${dragRow('Ask the neighbours about the fence')}
      ${dragRow('Sort the loft boxes', '', true)}`,
    )}
    <div style="font-size: 12.5px; line-height: 18px; color: ${MUTED}; padding: 0 2px;">Completed tasks are hidden in this mode — their order is not a thing anyone arranges.</div>`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

export default screens
