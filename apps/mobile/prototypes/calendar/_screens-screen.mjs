/**
 * ROW 1 — What the calendar screen IS.
 *
 * Three answers to "what is the front door of this Module", not three skins.
 * Fixed in all three: Huize Jansen, September 2026, today is Wednesday the
 * 2nd, two calendars (Household olive, School teal), three members (E/S/M).
 * Colour is the calendar; an initial in a circle is the person.
 */
import {
  BG,
  BORDER,
  CAL,
  EVENTS,
  FG,
  HOME_BAR,
  MEM,
  MUTED,
  P,
  STATUS,
  SURFACE,
  TINT,
  WEEKDAYS,
  bigTitle,
  dayNum,
  ic,
  longDate,
  monthGrid,
  on,
  page,
  parseDay,
  sheet,
  tabBar,
  timeOf,
  topActions,
  weekdayStrip,
  whoRow,
} from './_kit.mjs'

/* `monthGrid` always returns six rows so a sheet does not jump when you page
 * it. September 2026 leaves the sixth entirely empty, and a full screen has
 * no reason to paint 52 blank points — so a trailing all-null row is dropped
 * here. That difference is a note in the brief, not an accident. */
const weeks = monthGrid(2026, 8).weeks.filter((w) => w.some(Boolean))

const fixtures = `const EVENTS = ${JSON.stringify(EVENTS)};
const CAL = ${JSON.stringify(CAL)};
const MEM = ${JSON.stringify(MEM)};
const WEEKS = ${JSON.stringify(weeks)};
const TODAY = '2026-09-02';
const num = (iso) => Number(iso.slice(8));
const on = (iso) => EVENTS.filter((e) => e.date === iso);
const timeOf = (e) => (e.allDay ? 'all-day' : e.end ? e.start + '\\u2013' + e.end : e.start);
const longDate = (iso) => new Date(Number(iso.slice(0,4)), Number(iso.slice(5,7)) - 1, num(iso))
  .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });`

/* ══ A — The month grid, the day beneath ═══════════════════════════════ */

const scriptA = `${fixtures}
const MONTHS = ['August 2026', 'September 2026', 'October 2026'];

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { month: 1, sel: TODAY };
  }
  renderVals() {
    const here = this.state.month === 1;
    const sel = this.state.sel;
    const cells = WEEKS.flat().map((iso, i) => {
      if (!here || iso === null) {
        return { key: 'e' + i, num: '', style: 'height: 52px;', numStyle: 'display: none;', dots: [], pick: () => {} };
      }
      const isSel = iso === sel;
      const isToday = iso === TODAY;
      const evs = on(iso);
      return {
        key: iso,
        num: String(num(iso)),
        style: 'height: 52px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; cursor: pointer; border-radius: 12px;' + (isSel ? ' background: ${TINT};' : ''),
        numStyle: 'font-size: 16.5px; letter-spacing: -0.2px; width: 27px; height: 27px; display: flex; align-items: center; justify-content: center; border-radius: 999px;'
          + (isSel ? ' color: ${SURFACE}; font-weight: 700;'
            : isToday ? ' color: ${SURFACE}; background: ${TINT}; font-weight: 700;'
            : ' color: ${FG};'),
        dots: evs.slice(0, 3).map((e, j) => ({
          key: iso + j,
          style: 'width: 6px; height: 6px; border-radius: 999px; flex: none; background: ' + (isSel ? '${SURFACE}' : CAL[e.cal].fg) + ';',
        })),
        pick: () => this.setState({ sel: iso }),
      };
    });
    const evs = here ? on(sel) : [];
    return {
      monthName: MONTHS[this.state.month],
      cells,
      dayLabel: here ? longDate(sel) : '\\u2014',
      empty: evs.length === 0,
      events: evs.map((e, i) => ({
        key: i,
        title: e.title,
        time: timeOf(e),
        bar: 'width: 3px; align-self: stretch; margin: 10px 0; border-radius: 2px; flex: none; background: ' + CAL[e.cal].fg + ';',
        who: e.who.map((k) => ({ key: k, text: k, style: 'width: 21px; height: 21px; border-radius: 999px; background: ${SURFACE}; border: 1.4px solid ' + CAL[e.cal].fg + '; color: ' + CAL[e.cal].fg + '; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none;' })),
      })),
      prev: () => this.setState({ month: Math.max(0, this.state.month - 1) }),
      next: () => this.setState({ month: Math.min(2, this.state.month + 1) }),
      today: () => this.setState({ month: 1, sel: TODAY }),
    };
  }
}`

const ScreenA = page(
  `${STATUS}
${topActions(ic(P.plus, { size: 24, color: TINT, sw: 2.2 }))}
${bigTitle('Calendar', 'Huize Jansen')}
  <div style="flex: none; display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 16px;">
    <div onClick="{{ prev }}" style="cursor: pointer;">${ic(P.chevronL, { size: 20, color: TINT, sw: 2.2 })}</div>
    <div style="font-size: 17px; font-weight: 700; letter-spacing: -0.3px;">{{ monthName }}</div>
    <div onClick="{{ next }}" style="cursor: pointer;">${ic(P.chevronR, { size: 20, color: TINT, sw: 2.2 })}</div>
    <div style="flex: 1;"></div>
    <div onClick="{{ today }}" style="font-size: 15.5px; font-weight: 600; color: ${TINT}; cursor: pointer;">Today</div>
  </div>
${weekdayStrip('0 10px')}
  <div style="flex: none; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; padding: 0 10px;">
    <sc-for list="{{ cells }}" as="c" hint-placeholder-count="35">
      <div onClick="{{ c.pick }}" style="{{ c.style }}">
        <div style="{{ c.numStyle }}">{{ c.num }}</div>
        <div style="display: flex; gap: 3px; height: 6px; align-items: center;">
          <sc-for list="{{ c.dots }}" as="d" hint-placeholder-count="2">
            <span style="{{ d.style }}"></span>
          </sc-for>
        </div>
      </div>
    </sc-for>
  </div>
  <div style="flex: 1; min-height: 0; overflow: hidden; margin-top: 14px; border-top: 1px solid ${BORDER}; background: ${SURFACE};">
    <div style="padding: 14px 16px 6px; font-size: 13px; font-weight: 700; letter-spacing: 0.4px; color: ${MUTED}; text-transform: uppercase;">{{ dayLabel }}</div>
    <div style="padding: 0 16px;">
      <sc-if value="{{ empty }}" hint-placeholder-val="{{ false }}">
        <div style="font-size: 15px; color: ${MUTED}; padding: 6px 0 14px;">Nothing on.</div>
      </sc-if>
      <sc-for list="{{ events }}" as="e" hint-placeholder-count="1">
        <div style="display: flex; align-items: center; gap: 11px; min-height: 56px; border-bottom: 1px solid ${BORDER};">
          <span style="{{ e.bar }}"></span>
          <span style="width: 52px; flex: none; font-size: 12.5px; font-weight: 600; color: ${MUTED};">{{ e.time }}</span>
          <span style="flex: 1; font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ e.title }}</span>
          <span style="display: inline-flex; gap: 3px; flex: none;">
            <sc-for list="{{ e.who }}" as="w" hint-placeholder-count="2">
              <span style="{{ w.style }}">{{ w.text }}</span>
            </sc-for>
          </span>
        </div>
      </sc-for>
      <div style="display: flex; align-items: center; gap: 9px; min-height: 52px; cursor: pointer;">
        ${ic(P.plus, { size: 18, color: TINT, sw: 2.2 })}<span style="font-size: 15.5px; color: ${TINT};">Add an event</span>
      </div>
    </div>
  </div>
${tabBar()}
${HOME_BAR(SURFACE)}`,
  scriptA,
)

/* ══ B — A week strip, the agenda beneath ══════════════════════════════ */

const scriptB = `${fixtures}

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { open: false, sel: TODAY };
  }
  renderVals() {
    const sel = this.state.sel;
    const open = this.state.open;
    const selWeek = WEEKS.find((w) => w.includes(sel)) || WEEKS[0];
    const source = open ? WEEKS.flat() : selWeek;

    const cell = (iso, i) => {
      if (iso === null) return { key: 'e' + i, num: '', style: 'height: 46px;', numStyle: 'display: none;', dots: [], pick: () => {} };
      const isSel = iso === sel;
      const isToday = iso === TODAY;
      const evs = on(iso);
      return {
        key: iso,
        num: String(num(iso)),
        style: 'height: 46px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer;',
        numStyle: 'font-size: 16.5px; width: 29px; height: 29px; display: flex; align-items: center; justify-content: center; border-radius: 999px; letter-spacing: -0.2px;'
          + (isSel ? ' background: ${TINT}; color: ${SURFACE}; font-weight: 700;'
            : isToday ? ' color: ${TINT}; font-weight: 700; box-shadow: inset 0 0 0 1.6px ${TINT};'
            : ' color: ${FG};'),
        dots: evs.slice(0, 3).map((e, j) => ({
          key: iso + j,
          style: 'width: 5px; height: 5px; border-radius: 999px; flex: none; background: ' + CAL[e.cal].fg + ';',
        })),
        pick: () => this.setState({ sel: iso }),
      };
    };

    // The agenda runs from the selected day to the end of the month, empty
    // days omitted — an empty day is not a thing you scroll past on purpose.
    const days = [];
    for (const iso of WEEKS.flat()) {
      if (iso === null || iso < sel) continue;
      const evs = on(iso);
      if (evs.length === 0) continue;
      days.push({
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

    return {
      cells: source.map(cell),
      open,
      gridStyle: 'flex: none; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; padding: 0 10px 6px;',
      caret: open ? 'transform: rotate(180deg); transform-origin: center;' : '',
      days,
      none: days.length === 0,
      toggle: () => this.setState({ open: !this.state.open }),
      today: () => this.setState({ sel: TODAY }),
    };
  }
}`

const ScreenB = page(
  `${STATUS}
${topActions(ic(P.plus, { size: 24, color: TINT, sw: 2.2 }))}
  <div style="flex: none; display: flex; align-items: center; height: 44px; padding: 0 16px;">
    <div onClick="{{ toggle }}" style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
      <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.7px;">September</span>
      <span style="font-size: 26px; font-weight: 400; letter-spacing: -0.7px; color: ${MUTED};">2026</span>
      <span style="{{ caret }}">${ic(P.chevronD, { size: 20, color: TINT, sw: 2.4 })}</span>
    </div>
    <div style="flex: 1;"></div>
    <div onClick="{{ today }}" style="font-size: 15.5px; font-weight: 600; color: ${TINT}; cursor: pointer;">Today</div>
  </div>
  <div style="flex: none; background: ${SURFACE}; border-bottom: 1px solid ${BORDER}; padding-top: 2px;">
${weekdayStrip('0 10px')}
    <div style="{{ gridStyle }}">
      <sc-for list="{{ cells }}" as="c" hint-placeholder-count="7">
        <div onClick="{{ c.pick }}" style="{{ c.style }}">
          <div style="{{ c.numStyle }}">{{ c.num }}</div>
          <div style="display: flex; gap: 3px; height: 5px; align-items: center;">
            <sc-for list="{{ c.dots }}" as="d" hint-placeholder-count="2">
              <span style="{{ d.style }}"></span>
            </sc-for>
          </div>
        </div>
      </sc-for>
    </div>
    <div style="height: 12px; display: flex; align-items: center; justify-content: center;">
      <span style="width: 36px; height: 4px; border-radius: 2px; background: ${BORDER};"></span>
    </div>
  </div>
  <div style="flex: 1; min-height: 0; overflow: hidden;">
    <sc-if value="{{ none }}" hint-placeholder-val="{{ false }}">
      <div style="padding: 28px 16px; font-size: 15px; color: ${MUTED};">Nothing left this month.</div>
    </sc-if>
    <sc-for list="{{ days }}" as="d" hint-placeholder-count="4">
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
    </sc-for>
  </div>
${tabBar()}
${HOME_BAR(SURFACE)}`,
  scriptB,
)

/* ══ C — Agenda first, the month demoted to a picker ════════════════════ */

const agendaDays = weeks
  .flat()
  .filter(Boolean)
  .map((iso) => ({ iso, evs: on(iso) }))

const gap = (from, to) =>
  `<div style="display: flex; align-items: center; gap: 12px; padding: 13px 16px; background: ${BG};">
      <span style="flex: 1; height: 1px; background: ${BORDER};"></span>
      <span style="font-size: 12.5px; color: ${MUTED}; white-space: nowrap;">${from}–${to} September · nothing on</span>
      <span style="flex: 1; height: 1px; background: ${BORDER};"></span>
    </div>`

let agendaBody = ''
let run = []
for (const d of agendaDays) {
  if (d.evs.length === 0) {
    run.push(dayNum(d.iso))
    continue
  }
  if (run.length > 2) agendaBody += gap(run[0], run[run.length - 1])
  run = []
  const isToday = d.iso === '2026-09-02'
  agendaBody += `<div style="display: flex; gap: 12px; padding: 0 16px; background: ${SURFACE}; border-bottom: 1px solid ${BORDER};">
      <div style="width: 42px; flex: none; padding: 13px 0 13px; text-align: center;">
        <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: ${isToday ? TINT : MUTED};">${parseDay(d.iso).toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()}</div>
        <div style="font-size: 21px; font-weight: 700; letter-spacing: -0.4px; margin-top: 1px; color: ${isToday ? SURFACE : FG}; ${isToday ? `background: ${TINT}; border-radius: 999px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; margin: 2px auto 0;` : ''}">${dayNum(d.iso)}</div>
      </div>
      <div style="flex: 1; min-width: 0; padding: 8px 0;">
        ${d.evs
          .map(
            (e, i) => `<div style="display: flex; align-items: center; gap: 10px; min-height: 44px;${i === d.evs.length - 1 ? '' : ` border-bottom: 1px solid ${BORDER};`}">
          <span style="width: 3px; align-self: stretch; margin: 8px 0; border-radius: 2px; background: ${CAL[e.cal].fg}; flex: none;"></span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.title}</div>
            <div style="font-size: 12.5px; color: ${MUTED}; margin-top: 1px;">${timeOf(e)} · ${CAL[e.cal].name}</div>
          </div>
          ${whoRow(e.who, { size: 21, tint: CAL[e.cal].fg })}
        </div>`,
          )
          .join('\n        ')}
      </div>
    </div>`
}

const pickerGrid = `<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px;">${weeks
  .flat()
  .map((iso) => {
    if (!iso)
      return '<div style="height: 42px;"></div>'
    const isToday = iso === '2026-09-02'
    return `<div style="height: 42px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;">
          <span style="font-size: 16px; width: 27px; height: 27px; display: flex; align-items: center; justify-content: center; border-radius: 999px;${isToday ? ` background: ${TINT}; color: ${SURFACE}; font-weight: 700;` : ` color: ${FG};`}">${dayNum(iso)}</span>
          <span style="display: flex; gap: 3px; height: 5px;">${on(iso)
            .slice(0, 3)
            .map((e) => `<span style="width: 5px; height: 5px; border-radius: 999px; background: ${CAL[e.cal].fg};"></span>`)
            .join('')}</span>
        </div>`
  })
  .join('')}</div>`

const scriptC = `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { picker: false };
  }
  renderVals() {
    return {
      picker: this.state.picker,
      open: () => this.setState({ picker: true }),
      close: () => this.setState({ picker: false }),
    };
  }
}`

const ScreenC = page(
  `${STATUS}
${topActions(
  `<div onClick="{{ open }}" style="cursor: pointer;">${ic(P.calendar, { size: 22, color: TINT, sw: 1.9 })}</div>${ic(P.plus, { size: 24, color: TINT, sw: 2.2 })}`,
)}
${bigTitle('Calendar', 'Huize Jansen')}
  <div style="flex: 1; min-height: 0; overflow: hidden;">
    <div style="padding: 4px 16px 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: ${MUTED};">SEPTEMBER 2026</div>
    ${agendaBody}
  </div>
${tabBar()}
${HOME_BAR(SURFACE)}
  <sc-if value="{{ picker }}" hint-placeholder-val="{{ false }}">
    <div>
${sheet(
  `      <div style="display: flex; align-items: center; padding-bottom: 2px;">
        <div style="flex: 1; font-size: 17px; font-weight: 700;">September 2026</div>
        <div style="display: flex; gap: 18px;">
          <span style="cursor: pointer;">${ic(P.chevronL, { size: 20, color: TINT, sw: 2.2 })}</span>
          <span style="cursor: pointer;">${ic(P.chevronR, { size: 20, color: TINT, sw: 2.2 })}</span>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));">${WEEKDAYS.map(
        (d) =>
          `<div style="text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: ${MUTED}; padding-bottom: 4px;">${d}</div>`,
      ).join('')}</div>
      ${pickerGrid}`,
  { onClose: '{{ close }}' },
)}
    </div>
  </sc-if>`,
  scriptC,
)

export default {
  'ScreenA.dc.html': ScreenA,
  'ScreenB.dc.html': ScreenB,
  'ScreenC.dc.html': ScreenC,
}
