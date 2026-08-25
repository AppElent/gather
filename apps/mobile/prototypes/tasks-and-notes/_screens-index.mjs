/** The Tasks lists index — THE MIX, plus directions A, B and C. */
import {
  BG, BORDER, DANGER, DANGER_BG, FG, HOME_BAR, MUTED, P, STATIC, STATUS,
  SURFACE, TILE, TINT, TINT_BG, badge, bigTitle, card, checkbox, chip, ic,
  label, navBar, page, row, scroll, tabBar, topActions,
} from './_kit.mjs'

const screens = {}

/* ── THE MIX — Lists ─────────────────────────────────────────────────── */
/* A's rows with open counts + a TODAY strip lifted off C. Linked lists sit in
   the same card as the local ones, marked with their provider — where a list
   is stored is not a reason to file it somewhere else. Today's rows tick. */
screens['Main.dc.html'] = page(
  `${STATUS}
${topActions(`${ic(P.plus, { size: 24, color: TINT, sw: 2.2 })}${ic(P.more, { size: 22, color: TINT })}`)}
${bigTitle('Tasks', 'Huize Jansen · 6 lists')}
${scroll(
  `    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('TODAY')}
      ${card(`<sc-for list="{{ today }}" as="t" hint-placeholder-count="2">
        <div onClick="{{ t.toggle }}" style="{{ t.rowStyle }}">
          <sc-if value="{{ t.on }}" hint-placeholder-val="{{ false }}">${checkbox(true)}</sc-if>
          <sc-if value="{{ t.off }}" hint-placeholder-val="{{ true }}">${checkbox(false)}</sc-if>
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px;">
            <span style="{{ t.titleStyle }}">{{ t.title }}</span>
            <span style="font-size: 12.5px; color: ${MUTED};">{{ t.list }}</span>
          </div>
          <span style="{{ t.dueStyle }}">{{ t.due }}</span>
        </div>
      </sc-for>`)}
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('YOUR LISTS')}
      ${card(
        [
          ['Household', '{{ householdOpen }}', ''],
          ['Shopping', '3', ''],
          ['Work', '12', 'Todoist'],
          ['Emma to-dos', '2', ''],
          ['Emma questions', '1', ''],
          ['Care notes', '4', 'Notion'],
        ]
          .map(([name, open, provider]) =>
            row(
              `${ic(P.listChecks, { size: 19, color: TINT })}<div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 7px;"><span style="font-size: 16.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</span>${provider ? badge(provider, MUTED, TILE) : ''}</div><span style="font-size: 15px; color: ${MUTED};">${open}</span>${ic(P.chevronR, { size: 18, color: '#a9aeaa', sw: 2.2 })}`,
              { min: 56 },
            ),
          )
          .join('\n        ') +
          `\n        ${row(`${ic(P.plus, { size: 19, color: TINT, sw: 2.2 })}<span style="flex: 1; font-size: 16px; color: ${TINT};">New list</span>`, { min: 52, last: true })}`,
      )}
    </div>`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
  `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { done: {} };
  }

  renderVals() {
    const items = [
      { id: 'parcel', title: 'Pick up the parcel from the DHL point', list: 'Household', due: 'Today' },
      { id: 'bread', title: 'Bread and something for Thursday', list: 'Shopping', due: 'Today' }
    ];
    const done = this.state.done;
    const ROW = 'display:flex;align-items:center;gap:11px;min-height:56px;cursor:pointer;';
    return {
      householdOpen: done.parcel ? '6' : '7',
      today: items.map((item, i) => {
        const on = !!done[item.id];
        return {
          title: item.title,
          list: item.list,
          due: on ? 'Done' : item.due,
          rowStyle: ROW + (i === 0 ? 'border-bottom:1px solid ${BORDER};' : ''),
          titleStyle: 'font-size:15.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + (on ? 'color:${MUTED};text-decoration:line-through;' : 'color:${FG};'),
          dueStyle: 'font-size:12.5px;font-weight:700;white-space:nowrap;' + (on ? 'color:${MUTED};' : 'color:${TINT};'),
          on: on,
          off: !on,
          toggle: () => {
            const next = Object.assign({}, this.state.done);
            next[item.id] = !next[item.id];
            this.setState({ done: next });
          }
        };
      })
    };
  }
}`,
)

/* ── A — Rows with open counts ───────────────────────────────────────── */
screens['ListsA.dc.html'] = page(
  `${STATUS}
${topActions(`${ic(P.plus, { size: 24, color: TINT, sw: 2.2 })}`)}
${bigTitle('Tasks', 'Huize Jansen')}
${scroll(
  `    ${card(
    [
      ['Household', '7 open'],
      ['Shopping', '3 open'],
      ['Emma to-dos', '2 open'],
      ['Emma questions', '1 open'],
      ['Sinterklaas', 'All done'],
    ]
      .map(([name, open]) =>
        row(
          `<span style="flex: 1; font-size: 16.5px; font-weight: 600;">${name}</span><span style="font-size: 15px; color: ${MUTED};">${open}</span>${ic(P.chevronR, { size: 18, color: '#a9aeaa', sw: 2.2 })}`,
          { min: 56 },
        ),
      )
      .join('\n    ') +
      `\n    ${row(`<div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px;"><span style="font-size: 16.5px; font-weight: 600;">Work</span>${badge('Todoist', MUTED, TILE)}</div><span style="font-size: 15px; color: ${MUTED};">12 open</span>${ic(P.chevronR, { size: 18, color: '#a9aeaa', sw: 2.2 })}`, { min: 56 })}
    ${row(`<div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px;"><span style="font-size: 16.5px; font-weight: 600;">Care notes</span>${badge('Notion', MUTED, TILE)}</div><span style="font-size: 15px; color: ${MUTED};">4 open</span>${ic(P.chevronR, { size: 18, color: '#a9aeaa', sw: 2.2 })}`, { min: 56 })}
    ${row(`${ic(P.plus, { size: 19, color: TINT, sw: 2.2 })}<span style="flex: 1; font-size: 16px; color: ${TINT};">New list</span>`, { min: 52, last: true })}`,
  )}
    <div style="font-size: 13px; line-height: 19px; color: ${MUTED}; padding: 0 2px;">Hold a list for Rename, Reorder and Delete. Linked lists carry their provider's name and open read-only.</div>`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

/* ── B — Cards with a peek ───────────────────────────────────────────── */
const peek = (name, count, lines, tintFg = TINT, tintBg = TINT_BG, more = '') =>
  `      <div style="background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 16px; padding: 14px 15px 12px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 9px;">
          <span style="flex: 1; font-size: 17.5px; font-weight: 700; letter-spacing: -0.3px;">${name}</span>
          <span style="font-size: 12.5px; font-weight: 700; color: ${tintFg}; background: ${tintBg}; border-radius: 8px; padding: 4px 9px;">${count}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 9px;">
${lines
  .map(
    ([text, meta, red]) =>
      `          <div style="display: flex; align-items: center; gap: 10px;">${checkbox(false)}<span style="flex: 1; font-size: 14.5px; color: ${FG}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${text}</span>${meta ? `<span style="font-size: 12px; font-weight: 700; color: ${red ? DANGER : MUTED}; white-space: nowrap;">${meta}</span>` : ''}</div>`,
  )
  .join('\n')}
        </div>${more ? `
        <span style="font-size: 13px; color: ${TINT}; font-weight: 600;">${more}</span>` : ''}
      </div>`

screens['ListsB.dc.html'] = page(
  `${STATUS}
${topActions(`${ic(P.plus, { size: 24, color: TINT, sw: 2.2 })}`)}
${bigTitle('Tasks', 'Huize Jansen')}
${scroll(
  `${peek('Household', '7 open', [
    ['Call the plumber about the radiator', 'Tue', true],
    ['Pick up the parcel from the DHL point', 'Today'],
    ["Renew Emma's passport", '4 Sep'],
  ], TINT, TINT_BG, '4 more')}
${peek('Shopping', '3 open', [
  ['Bread and something for Thursday', 'Today'],
  ['Nappies, size 4', ''],
  ['Birthday card for Mum', '30 Aug'],
])}
${peek('Emma to-dos', '2 open', [
  ['Book the 9-month check', '11 Sep'],
  ['Return the borrowed pram', ''],
])}`,
  '12px 16px 0',
  14,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

/* ── C — Lists are a filter, not a place ─────────────────────────────── */
const cRow = (title, meta, list, red = false, last = false) =>
  `          <div style="display: flex; align-items: center; gap: 11px; min-height: 58px;${last ? '' : ` border-bottom: 1px solid ${BORDER};`}">${checkbox(false)}<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px;"><span style="font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</span><span style="font-size: 12.5px; color: ${MUTED};">${list}</span></div><span style="font-size: 12.5px; font-weight: 700; color: ${red ? DANGER : MUTED}; white-space: nowrap;">${meta}</span></div>`

screens['ListsC.dc.html'] = page(
  `${STATUS}
${topActions(`${ic(P.search, { size: 22, color: TINT })}${ic(P.plus, { size: 24, color: TINT, sw: 2.2 })}`)}
${bigTitle('Tasks', 'Huize Jansen')}
  <div style="flex: none; display: flex; gap: 8px; padding: 0 16px 14px; overflow: hidden;">
    <sc-for list="{{ filters }}" as="f" hint-placeholder-count="5">
      <span onClick="{{ f.pick }}" style="{{ f.style }}">{{ f.name }}</span>
    </sc-for>
  </div>
${scroll(
  `    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('OVERDUE')}
      ${card(`{{ overdueRows }}`)}
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('TODAY')}
      ${card(`{{ todayRows }}`)}
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('THIS WEEK')}
      ${card(`{{ weekRows }}`)}
    </div>`,
  '0 16px 0',
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
  `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { filter: 'All' };
  }

  renderVals() {
    const names = ['All', 'Household', 'Shopping', 'Emma to-dos', 'Work'];
    const ON = 'font-size:13.5px;font-weight:600;padding:7px 13px;border-radius:999px;white-space:nowrap;background:${TINT};color:${SURFACE};cursor:pointer;';
    const OFF = 'font-size:13.5px;font-weight:600;padding:7px 13px;border-radius:999px;white-space:nowrap;background:${SURFACE};color:${FG};border:1px solid ${BORDER};cursor:pointer;';
    return {
      filters: names.map((name) => ({
        name: name,
        style: this.state.filter === name ? ON : OFF,
        pick: () => this.setState({ filter: name })
      }))
    };
  }
}`,
)

/* The three grouped cards are markup, so they are substituted rather than
   bound — the filter chips are the live part. */
screens['ListsC.dc.html'] = screens['ListsC.dc.html']
  .replace(
    '{{ overdueRows }}',
    '\n' + cRow('Call the plumber about the radiator', 'Tue', 'Household', true, true) + '\n        ',
  )
  .replace(
    '{{ todayRows }}',
    '\n' +
      cRow('Pick up the parcel from the DHL point', 'Today', 'Household') +
      '\n' +
      cRow('Bread and something for Thursday', 'Today', 'Shopping', false, true) +
      '\n        ',
  )
  .replace(
    '{{ weekRows }}',
    '\n' +
      cRow('Book the MOT', 'Thu', 'Household') +
      '\n' +
      cRow('Birthday card for Mum', 'Sat', 'Shopping') +
      '\n' +
      cRow('Send the invoice', 'Fri', 'Work · Todoist', false, true) +
      '\n        ',
  )

export default screens
