/**
 * THE MIX — the chosen design.
 *
 * Row 1: all three layouts kept, behind the switcher iOS already has —
 *   an `ellipsis.circle` in the nav bar opening a menu with a checkmark on
 *   the current view. One screen, three layouts, live.
 * Row 2: C. Initials, tinted by the calendar, with the fallback the
 *   direction artboard never had to answer: an event with nobody on it is a
 *   dot in its calendar's colour.
 * Row 3: B, re-cut as Todoist's compact composer — a card above the
 *   keyboard, the name field first and largest, everything else a chip.
 *
 * The three screen artboards are ONE component at three starting views, so
 * they cannot drift; only `START` differs.
 */
import {
  BORDER,
  CAL,
  DANGER,
  FG,
  HOME_BAR,
  MIX_EVENTS,
  MUTED,
  P,
  STATUS,
  SURFACE,
  TILE,
  TINT,
  TINT_BG,
  WEEKDAYS,
  dayNum,
  ic,
  monthGrid,
  page,
  tabBar,
  topActions,
  weekdayStrip,
} from './_kit.mjs'

const weeks = monthGrid(2026, 8).weeks.filter((w) => w.some(Boolean))

/* ══ The screen — one component, three views ═══════════════════════════ */

const screenScript = (start) => `const EVENTS = ${JSON.stringify(MIX_EVENTS)};
const CAL = ${JSON.stringify(CAL)};
const WEEKS = ${JSON.stringify(weeks)};
const TODAY = '2026-09-02';
const num = (iso) => Number(iso.slice(8));
const on = (iso) => EVENTS.filter((e) => e.date === iso);
const timeOf = (e) => (e.allDay ? 'all-day' : e.end ? e.start + '\\u2013' + e.end : e.start);
const fmt = (iso, o) => new Date(Number(iso.slice(0,4)), Number(iso.slice(5,7)) - 1, num(iso)).toLocaleDateString('en-GB', o);
const longDate = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { view: '${start}', menu: false, sel: TODAY };
  }

  /* One cell. Colour is the calendar; an initial is the person; a dot is an
     event nobody has been put on yet — which today is all of them. */
  cell(iso, i, h) {
    if (iso === null) {
      return { key: 'e' + i, num: '', style: 'height: ' + h + 'px;', numStyle: 'display: none;', marks: [], pick: () => {} };
    }
    const isSel = iso === this.state.sel;
    const isToday = iso === TODAY;
    const evs = on(iso);
    const marks = [];
    for (const e of evs) {
      if (marks.length === 3) break;
      if (e.who.length === 0) {
        marks.push({ key: marks.length, text: '', style: 'width: 8px; height: 8px; border-radius: 999px; flex: none; background: ' + CAL[e.cal].fg + ';' });
      } else {
        for (const k of e.who) {
          if (marks.length === 3) break;
          marks.push({ key: marks.length, text: k, style: 'width: 19px; height: 19px; border-radius: 999px; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none; background: ' + CAL[e.cal].bg + '; color: ' + CAL[e.cal].fg + ';' });
        }
      }
    }
    const total = evs.reduce((n, e) => n + Math.max(1, e.who.length), 0);
    if (total > 3) marks.push({ key: 'n', text: '+' + (total - 3), style: 'font-size: 10px; font-weight: 700; color: ${MUTED};' });
    return {
      key: iso,
      num: String(num(iso)),
      style: 'height: ' + h + 'px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding-top: 5px; cursor: pointer; border-radius: 10px;'
        + (isSel ? ' background: ${TILE}; box-shadow: inset 0 0 0 1.6px ${TINT};' : ''),
      numStyle: 'font-size: 12.5px; font-weight: 600; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 999px; flex: none;'
        + (isToday ? ' background: ${TINT}; color: ${SURFACE};' : ' color: ${MUTED};'),
      marks,
      pick: () => this.setState({ sel: iso }),
    };
  }

  agendaDays(from) {
    const out = [];
    for (const iso of WEEKS.flat()) {
      if (iso === null || iso < from) continue;
      const evs = on(iso);
      if (evs.length === 0) continue;
      out.push({
        key: iso,
        label: (iso === TODAY ? 'TODAY \\u00b7 ' : '') + longDate(iso).toUpperCase(),
        labelStyle: 'padding: 15px 16px 5px; font-size: 12px; font-weight: 700; letter-spacing: 0.7px; color: ' + (iso === TODAY ? '${TINT}' : '${MUTED}') + ';',
        events: evs.map((e, i) => ({
          key: i,
          title: e.title,
          time: e.allDay ? 'all-day' : e.start,
          bar: 'width: 3px; align-self: stretch; margin: 10px 0; border-radius: 2px; flex: none; background: ' + CAL[e.cal].fg + ';',
          who: e.who.map((k) => ({ key: k, text: k, style: 'width: 21px; height: 21px; border-radius: 999px; background: ${SURFACE}; border: 1.4px solid ' + CAL[e.cal].fg + '; color: ' + CAL[e.cal].fg + '; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none;' })),
        })),
      });
    }
    return out;
  }

  renderVals() {
    const v = this.state.view;
    const selWeek = WEEKS.find((w) => w.includes(this.state.sel)) || WEEKS[0];
    const menuRow = (id) => ({
      style: 'display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 14px; cursor: pointer;' + (id === 'calendars' ? '' : ' border-bottom: 1px solid rgba(31,36,33,0.10);'),
      on: v === id,
      pick: () => this.setState({ view: id, menu: false }),
    });
    return {
      month: v === 'month',
      week: v === 'week',
      agenda: v === 'agenda',
      menu: this.state.menu,
      monthCells: WEEKS.flat().map((iso, i) => this.cell(iso, i, 56)),
      weekCells: selWeek.map((iso, i) => this.cell(iso, i, 56)),
      days: this.agendaDays(v === 'agenda' ? WEEKS.flat().find(Boolean) : this.state.sel),
      dayLabel: longDate(this.state.sel).toUpperCase(),
      dayEmpty: on(this.state.sel).length === 0,
      dayEvents: on(this.state.sel).map((e, i) => ({
        key: i,
        title: e.title,
        meta: timeOf(e) + ' \\u00b7 ' + CAL[e.cal].name,
        bar: 'width: 3px; align-self: stretch; margin: 9px 0; border-radius: 2px; flex: none; background: ' + CAL[e.cal].fg + ';',
        who: e.who.map((k) => ({ key: k, text: k, style: 'width: 21px; height: 21px; border-radius: 999px; background: ${SURFACE}; border: 1.4px solid ' + CAL[e.cal].fg + '; color: ' + CAL[e.cal].fg + '; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none;' })),
      })),
      rowMonth: menuRow('month'),
      rowWeek: menuRow('week'),
      rowAgenda: menuRow('agenda'),
      openMenu: () => this.setState({ menu: !this.state.menu }),
      closeMenu: () => this.setState({ menu: false }),
    };
  }
}`

const CHECK = `<svg class="ic" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8a6a33" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>`

/* iOS keeps the leading checkmark inset on unchecked rows too, so the labels
   stay aligned — hence the fixed 18px box around the conditional tick. */
const menuRow = (name, label, glyph) => `        <div onClick="{{ ${name}.pick }}" style="{{ ${name}.style }}">
          <span style="width: 18px; flex: none; display: flex; align-items: center;">
            <sc-if value="{{ ${name}.on }}" hint-placeholder-val="{{ true }}">${CHECK}</sc-if>
          </span>
          <span style="flex: 1; font-size: 16px; color: ${FG};">${label}</span>
          ${ic(glyph, { size: 19, color: FG })}
        </div>`

const ICON_WEEK =
  '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"></rect><path d="M3 10h18"></path><path d="M8 2v4"></path><path d="M16 2v4"></path><rect x="5.5" y="12.5" width="4" height="5" rx="1" fill="currentColor" stroke="none"></rect>'
const ICON_LIST =
  '<path d="M8 6h13"></path><path d="M8 12h13"></path><path d="M8 18h13"></path><circle cx="3.6" cy="6" r="1.3"></circle><circle cx="3.6" cy="12" r="1.3"></circle><circle cx="3.6" cy="18" r="1.3"></circle>'

const gridBlock = (list, pad = '0 10px') => `    <div style="flex: none; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; padding: ${pad};">
      <sc-for list="{{ ${list} }}" as="c" hint-placeholder-count="7">
        <div onClick="{{ c.pick }}" style="{{ c.style }}">
          <div style="{{ c.numStyle }}">{{ c.num }}</div>
          <div style="display: flex; gap: 3px; align-items: center; justify-content: center; flex-wrap: wrap;">
            <sc-for list="{{ c.marks }}" as="m" hint-placeholder-count="2">
              <span style="{{ m.style }}">{{ m.text }}</span>
            </sc-for>
          </div>
        </div>
      </sc-for>
    </div>`

const agendaBlock = `      <sc-for list="{{ days }}" as="d" hint-placeholder-count="4">
        <div>
          <div style="{{ d.labelStyle }}">{{ d.label }}</div>
          <div style="padding: 0 16px;">
            <sc-for list="{{ d.events }}" as="e" hint-placeholder-count="1">
              <div style="display: flex; align-items: center; gap: 11px; min-height: 54px; border-bottom: 1px solid ${BORDER};">
                <span style="{{ e.bar }}"></span>
                <span style="width: 50px; flex: none; font-size: 12.5px; font-weight: 600; color: ${MUTED};">{{ e.time }}</span>
                <span style="flex: 1; font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ e.title }}</span>
                <span style="display: inline-flex; gap: 3px; flex: none;">
                  <sc-for list="{{ e.who }}" as="w" hint-placeholder-count="2">
                    <span style="{{ w.style }}">{{ w.text }}</span>
                  </sc-for>
                </span>
              </div>
            </sc-for>
          </div>
        </div>
      </sc-for>`

const screen = (start) =>
  page(
    `${STATUS}
${topActions(
  `<div onClick="{{ openMenu }}" style="cursor: pointer;">${ic(P.moreCircle, { size: 24, color: TINT, sw: 1.7 })}</div>${ic(P.plus, { size: 24, color: TINT, sw: 2.2 })}`,
)}
  <div style="flex: none; display: flex; align-items: baseline; height: 44px; padding: 0 16px;">
    <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.7px;">September</span>
    <span style="font-size: 26px; font-weight: 400; letter-spacing: -0.7px; color: ${MUTED}; margin-left: 6px;">2026</span>
    <div style="flex: 1;"></div>
    <span style="font-size: 15.5px; font-weight: 600; color: ${TINT}; cursor: pointer;">Today</span>
  </div>

  <sc-if value="{{ month }}" hint-placeholder-val="{{ false }}">
    <div style="flex: none; background: ${SURFACE}; border-bottom: 1px solid ${BORDER}; padding-bottom: 6px;">
${weekdayStrip('0 10px')}
${gridBlock('monthCells')}
    </div>
  </sc-if>
  <sc-if value="{{ week }}" hint-placeholder-val="{{ true }}">
    <div style="flex: none; background: ${SURFACE}; border-bottom: 1px solid ${BORDER};">
${weekdayStrip('0 10px')}
${gridBlock('weekCells')}
      <div style="height: 14px; display: flex; align-items: center; justify-content: center;">
        <span style="width: 36px; height: 4px; border-radius: 2px; background: ${BORDER};"></span>
      </div>
    </div>
  </sc-if>

  <div style="flex: 1; min-height: 0; overflow: hidden;">
    <sc-if value="{{ month }}" hint-placeholder-val="{{ false }}">
      <div style="background: ${SURFACE}; height: 100%;">
        <div style="padding: 13px 16px 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.7px; color: ${MUTED};">{{ dayLabel }}</div>
        <div style="padding: 0 16px;">
          <sc-if value="{{ dayEmpty }}" hint-placeholder-val="{{ false }}">
            <div style="font-size: 15px; color: ${MUTED}; padding: 6px 0 14px;">Nothing on.</div>
          </sc-if>
          <sc-for list="{{ dayEvents }}" as="e" hint-placeholder-count="1">
            <div style="display: flex; align-items: center; gap: 11px; min-height: 52px; border-bottom: 1px solid ${BORDER};">
              <span style="{{ e.bar }}"></span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ e.title }}</div>
                <div style="font-size: 12.5px; color: ${MUTED}; margin-top: 1px;">{{ e.meta }}</div>
              </div>
              <span style="display: inline-flex; gap: 3px; flex: none;">
                <sc-for list="{{ e.who }}" as="w" hint-placeholder-count="2">
                  <span style="{{ w.style }}">{{ w.text }}</span>
                </sc-for>
              </span>
            </div>
          </sc-for>
        </div>
      </div>
    </sc-if>
    <sc-if value="{{ week }}" hint-placeholder-val="{{ true }}">
      <div>
${agendaBlock}
      </div>
    </sc-if>
    <sc-if value="{{ agenda }}" hint-placeholder-val="{{ false }}">
      <div>
${agendaBlock}
      </div>
    </sc-if>
  </div>
${tabBar()}
${HOME_BAR(SURFACE)}

  <sc-if value="{{ menu }}" hint-placeholder-val="{{ false }}">
    <div>
      <div onClick="{{ closeMenu }}" style="position: absolute; left: 0; top: 0; right: 0; bottom: 0;"></div>
      <div style="position: absolute; right: 12px; top: 84px; width: 252px; border-radius: 14px; overflow: hidden; background: rgba(250, 249, 247, 0.93); backdrop-filter: blur(22px); box-shadow: 0 10px 34px rgba(31, 36, 33, 0.22);">
${menuRow('rowMonth', 'Month', P.grid)}
${menuRow('rowWeek', 'Week', ICON_WEEK)}
${menuRow('rowAgenda', 'Agenda', ICON_LIST)}
        <div style="height: 7px; background: rgba(31,36,33,0.07);"></div>
        <div style="display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 14px; cursor: pointer;">
          <span style="width: 18px; flex: none;"></span>
          <span style="flex: 1; font-size: 16px; color: ${FG};">Calendars…</span>
          ${ic(P.eye, { size: 19, color: FG })}
        </div>
      </div>
    </div>
  </sc-if>`,
    screenScript(start),
  )

/* ══ The composer — Todoist's card, above the keyboard ═════════════════ */

/* The real keyboard draws itself over the app, so the bottom 336 points are
   left alone. The card floats immediately above where it will land. */
const KEYBOARD = 336

const CARD_BASE = `position: absolute; left: 10px; right: 10px; background: ${SURFACE}; border-radius: 26px; box-shadow: 0 8px 30px rgba(31, 36, 33, 0.20); padding: 20px 18px 16px; display: flex; flex-direction: column; gap: 16px; bottom: `
const CARD = (bottom) => `${CARD_BASE}${bottom}`

const composer = (inner, style = CARD(`${KEYBOARD + 10}px`)) =>
  `  <div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(31, 36, 33, 0.28);"></div>
  <div style="${style}">
${inner}
  </div>`


const behind = `  <div style="flex: none; display: flex; align-items: baseline; height: 44px; padding: 0 16px;">
    <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.7px;">September</span>
    <span style="font-size: 26px; font-weight: 400; letter-spacing: -0.7px; color: ${MUTED}; margin-left: 6px;">2026</span>
  </div>
  <div style="flex: none; background: ${SURFACE}; border-bottom: 1px solid ${BORDER};">
    <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding: 4px 10px 0;">${WEEKDAYS.map(
      (d) =>
        `<div style="text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: ${MUTED}; padding: 4px 0 6px;">${d}</div>`,
    ).join('')}</div>
    <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; padding: 0 10px 12px;">${weeks[0]
      .map((iso) =>
        iso === null
          ? '<div style="height: 46px;"></div>'
          : `<div style="height: 46px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding-top: 5px;"><span style="font-size: 12.5px; font-weight: 600; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 999px;${iso === '2026-09-02' ? ` background: ${TINT}; color: ${SURFACE};` : ` color: ${MUTED};`}">${dayNum(iso)}</span></div>`,
      )
      .join('')}</div>
  </div>
  <div style="flex: 1;"></div>`

const pill = (inner, { set = false, dashed = false, cal = null } = {}) => {
  const bg = cal ? CAL[cal].bg : set ? TINT_BG : SURFACE
  const fg = cal ? CAL[cal].fg : set ? TINT : MUTED
  const border = cal || set ? 'transparent' : BORDER
  return `<span style="display: inline-flex; align-items: center; gap: 6px; height: 44px; padding: 0 15px; border-radius: 999px; font-size: 15px; font-weight: 600; white-space: nowrap; flex: none; cursor: pointer; background: ${bg}; color: ${fg}; border: 1px ${dashed ? 'dashed' : 'solid'} ${border};">${inner}</span>`
}

const swatch = (cal) =>
  `<span style="width: 11px; height: 11px; border-radius: 3px; background: ${CAL[cal].fg}; flex: none;"></span>`

const pickerGrid = `<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px;">${weeks
  .flat()
  .map((iso) =>
    iso === null
      ? '<div style="height: 38px;"></div>'
      : `<div style="height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer;"><span style="font-size: 15.5px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 999px;${iso === '2026-09-02' ? ` background: ${TINT}; color: ${SURFACE}; font-weight: 700;` : ` color: ${FG};`}">${dayNum(iso)}</span></div>`,
  )
  .join('')}</div>`

const newScript = `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { title: '', pane: 'none' };
  }
  renderVals() {
    const has = this.state.title.trim().length > 0;
    return {
      card: '${CARD_BASE}' + (this.state.pane === 'date' ? '44px;' : '${KEYBOARD + 10}px;'),
      commit: 'width: 44px; height: 44px; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex: none; transition: background 120ms; background: ' + (has ? '${TINT}' : '#d9dbd7') + ';',
      date: this.state.pane === 'date',
      extra: this.state.pane === 'extra',
      dateChip: 'display: inline-flex; align-items: center; gap: 6px; height: 44px; padding: 0 15px; border-radius: 999px; font-size: 15px; font-weight: 600; white-space: nowrap; flex: none; cursor: pointer; border: 1px solid transparent; background: '
        + (this.state.pane === 'date' ? '${TINT}; color: ${SURFACE};' : '${TINT_BG}; color: ${TINT};'),
      onTitle: (e) => this.setState({ title: e.target.value }),
      openDate: () => this.setState({ pane: this.state.pane === 'date' ? 'none' : 'date' }),
      openExtra: () => this.setState({ pane: this.state.pane === 'extra' ? 'none' : 'extra' }),
      close: () => this.setState({ pane: 'none' }),
    };
  }
}`

const MixNew = page(
  `${STATUS}
${behind}
${HOME_BAR()}
${composer(`    <input class="f" onInput="{{ onTitle }}" placeholder="Event name" style="font-size: 21px; font-weight: 600; letter-spacing: -0.3px; caret-color: ${TINT};">
    <sc-if value="{{ date }}" hint-placeholder-val="{{ false }}">
      <div>
        <div style="display: flex; gap: 8px; padding-bottom: 12px;">
          <span style="flex: 1; text-align: center; font-size: 14px; font-weight: 600; padding: 10px 0; border-radius: 12px; border: 1px solid ${BORDER}; cursor: pointer;">Today</span>
          <span style="flex: 1; text-align: center; font-size: 14px; font-weight: 600; padding: 10px 0; border-radius: 12px; border: 1px solid ${BORDER}; cursor: pointer;">Tomorrow</span>
          <span style="flex: 1; text-align: center; font-size: 14px; font-weight: 600; padding: 10px 0; border-radius: 12px; border: 1px solid ${BORDER}; cursor: pointer;">Weekend</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 6px;">
          <span style="cursor: pointer;">${ic(P.chevronL, { size: 20, color: FG, sw: 2.2 })}</span>
          <span style="font-size: 16px; font-weight: 600;">September 2026</span>
          <span style="cursor: pointer;">${ic(P.chevronR, { size: 20, color: FG, sw: 2.2 })}</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));">${WEEKDAYS.map(
          (d) =>
            `<div style="text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: ${MUTED}; padding-bottom: 4px;">${d}</div>`,
        ).join('')}</div>
        ${pickerGrid}
        <div onClick="{{ close }}" style="text-align: center; font-size: 15.5px; font-weight: 600; color: ${TINT}; padding: 10px 0 2px; cursor: pointer;">Done</div>
      </div>
    </sc-if>
    <sc-if value="{{ extra }}" hint-placeholder-val="{{ false }}">
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        ${pill('All-day', { dashed: true })}
        ${pill(`${ic(P.pin, { size: 16, color: MUTED })}Where`, { dashed: true })}
        ${pill(`${ic(P.notebookPen, { size: 16, color: MUTED })}Notes`, { dashed: true })}
        ${pill('Repeats…', { dashed: true })}
      </div>
    </sc-if>
    <div style="position: relative;">
      <div style="display: flex; gap: 8px; overflow: hidden; padding-right: 56px;">
        <span onClick="{{ openExtra }}" style="width: 44px; height: 44px; border-radius: 999px; background: ${TILE}; display: flex; align-items: center; justify-content: center; flex: none; cursor: pointer;">${ic(P.plus, { size: 20, color: MUTED, sw: 2.2 })}</span>
        ${pill(`${swatch('house')}Household`, { cal: 'house' })}
        <span onClick="{{ openDate }}" style="{{ dateChip }}">Wed 2 Sep</span>
        ${pill(`${ic(P.clock, { size: 16, color: MUTED })}Time`, { dashed: true })}
        ${pill(`${ic(P.users, { size: 16, color: MUTED })}Who`, { dashed: true })}
      </div>
      <div style="position: absolute; right: 44px; top: 0; bottom: 0; width: 26px; background: linear-gradient(90deg, rgba(255,255,255,0), ${SURFACE});"></div>
      <div style="position: absolute; right: 0; top: 0;"><div style="{{ commit }}">${ic(P.arrowUp, { size: 21, color: SURFACE, sw: 2.6 })}</div></div>
    </div>`, '{{ card }}')}`,
  newScript,
)

const editScript = `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { menu: false };
  }
  renderVals() {
    return {
      menu: this.state.menu,
      openMenu: () => this.setState({ menu: !this.state.menu }),
    };
  }
}`

const MixEdit = page(
  `${STATUS}
${behind}
${HOME_BAR()}
${composer(`    <div style="display: flex; align-items: center; gap: 12px;">
      <input class="f" value="Dentist — Mila" style="font-size: 21px; font-weight: 600; letter-spacing: -0.3px; caret-color: ${TINT}; flex: 1;">
      <span onClick="{{ openMenu }}" style="cursor: pointer; flex: none;">${ic(P.moreCircle, { size: 24, color: MUTED, sw: 1.7 })}</span>
    </div>
    <sc-if value="{{ menu }}" hint-placeholder-val="{{ false }}">
      <div style="border: 1px solid ${BORDER}; border-radius: 14px; overflow: hidden;">
        <div style="display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 14px; border-bottom: 1px solid ${BORDER}; cursor: pointer;">
          <span style="flex: 1; font-size: 16px;">Duplicate</span>${ic(P.plus, { size: 18, color: FG })}
        </div>
        <div style="display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 14px; cursor: pointer;">
          <span style="flex: 1; font-size: 16px; color: ${DANGER};">Delete event</span>${ic(P.trash, { size: 18, color: DANGER })}
        </div>
      </div>
    </sc-if>
    <div style="position: relative;">
      <div style="display: flex; gap: 8px; overflow: hidden; padding-right: 56px;">
        <span style="width: 44px; height: 44px; border-radius: 999px; background: ${TILE}; display: flex; align-items: center; justify-content: center; flex: none; cursor: pointer;">${ic(P.plus, { size: 20, color: MUTED, sw: 2.2 })}</span>
        ${pill(`${swatch('house')}Household`, { cal: 'house' })}
        ${pill('Wed 2 Sep', { set: true })}
        ${pill('14:30 – 15:15', { set: true })}
        ${pill(
          `<span style="display: inline-flex; gap: 3px;">${['S', 'M']
            .map(
              (k) =>
                `<span style="width: 22px; height: 22px; border-radius: 999px; background: ${TINT}; color: ${SURFACE}; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center;">${k}</span>`,
            )
            .join('')}</span>`,
          { set: true },
        )}
      </div>
      <div style="position: absolute; right: 44px; top: 0; bottom: 0; width: 26px; background: linear-gradient(90deg, rgba(255,255,255,0), ${SURFACE});"></div>
      <div style="position: absolute; right: 0; top: 0;"><div style="width: 44px; height: 44px; border-radius: 999px; display: flex; align-items: center; justify-content: center; flex: none; background: ${TINT};">${ic(P.check, { size: 21, color: SURFACE, sw: 2.8 })}</div></div>
    </div>`)}`,
  editScript,
)

export default {
  'Main.dc.html': screen('week'),
  'MixMonth.dc.html': screen('month'),
  'MixAgenda.dc.html': screen('agenda'),
  'MixNew.dc.html': MixNew,
  'MixEdit.dc.html': MixEdit,
}
