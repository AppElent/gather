/**
 * ROW 2 — One cell, two channels.
 *
 * Colour is the calendar; an initial in a circle is the person. Given that,
 * how much is a 42-cell grid allowed to say before it becomes confetti?
 *
 * All three draw the SAME month at the SAME cell width. The only thing that
 * differs is what a cell is FOR. Each carries the same live control: a
 * Real / Busy switch, because the answer is entirely about density, and a
 * grid that reads beautifully with nine events a month proves nothing.
 */
import {
  BORDER,
  BUSY,
  CAL,
  EVENTS,
  FG,
  HOME_BAR,
  MUTED,
  P,
  STATUS,
  SURFACE,
  TILE,
  TINT,
  ic,
  monthGrid,
  page,
  tabBar,
  topActions,
  weekdayStrip,
} from './_kit.mjs'

const weeks = monthGrid(2026, 8).weeks.filter((w) => w.some(Boolean))

const script = (mode, cellH) => `const EVENTS = ${JSON.stringify(EVENTS)};
const BUSY = ${JSON.stringify(BUSY)};
const CAL = ${JSON.stringify(CAL)};
const WEEKS = ${JSON.stringify(weeks)};
const TODAY = '2026-09-02';
const MODE = '${mode}';
const CELL_H = ${cellH};
const num = (iso) => Number(iso.slice(8));
const timeOf = (e) => (e.allDay ? 'all-day' : e.end ? e.start + '\\u2013' + e.end : e.start);
const longDate = (iso) => new Date(Number(iso.slice(0,4)), Number(iso.slice(5,7)) - 1, num(iso))
  .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { busy: false, sel: TODAY };
  }
  renderVals() {
    const set = this.state.busy ? BUSY : EVENTS;
    const sel = this.state.sel;
    const on = (iso) => set.filter((e) => e.date === iso);

    const cells = WEEKS.flat().map((iso, i) => {
      if (iso === null) {
        return { key: 'e' + i, num: '', style: 'height: ' + CELL_H + 'px;', numStyle: 'display: none;', wrap: 'display: none;', marks: [], pick: () => {} };
      }
      const isSel = iso === sel;
      const isToday = iso === TODAY;
      const evs = on(iso);
      let numStyle;
      let wrap;
      let marks = [];

      if (MODE === 'dots') {
        numStyle = 'font-size: 16.5px; letter-spacing: -0.2px; width: 27px; height: 27px; display: flex; align-items: center; justify-content: center; border-radius: 999px;'
          + (isToday ? ' background: ${TINT}; color: ${SURFACE}; font-weight: 700;' : ' color: ${FG};');
        wrap = 'display: flex; gap: 3px; height: 6px; align-items: center; justify-content: center;';
        marks = evs.slice(0, 3).map((e, j) => ({
          key: j, text: '',
          style: 'width: 6px; height: 6px; border-radius: 999px; flex: none; background: ' + CAL[e.cal].fg + ';',
        }));
      } else if (MODE === 'bars') {
        numStyle = 'font-size: 12.5px; font-weight: 600; letter-spacing: -0.1px; padding: 3px 0 2px; text-align: center;'
          + (isToday ? ' color: ${TINT};' : ' color: ${MUTED};');
        wrap = 'display: flex; flex-direction: column; gap: 2px; padding: 0 2px;';
        marks = evs.slice(0, 2).map((e, j) => ({
          key: j, text: e.title,
          style: 'display: block; font-size: 9px; font-weight: 600; line-height: 13px; height: 13px; border-radius: 3px; padding: 0 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: ' + CAL[e.cal].bg + '; color: ' + CAL[e.cal].fg + ';',
        }));
        if (evs.length > 2) marks.push({ key: 'more', text: '+' + (evs.length - 2), style: 'display: block; font-size: 9px; font-weight: 700; line-height: 13px; height: 13px; padding: 0 3px; color: ${MUTED};' });
      } else {
        const seen = [];
        for (const e of evs) for (const k of e.who) if (!seen.some((s) => s.k === k)) seen.push({ k: k, cal: e.cal });
        numStyle = 'font-size: 12.5px; font-weight: 600; letter-spacing: -0.1px; padding: 3px 0 3px; text-align: center;'
          + (isToday ? ' color: ${TINT};' : ' color: ${MUTED};');
        wrap = 'display: flex; gap: 3px; align-items: center; justify-content: center; flex-wrap: wrap;';
        marks = seen.slice(0, 3).map((s, j) => ({
          key: j, text: s.k,
          style: 'width: 19px; height: 19px; border-radius: 999px; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none; background: ' + CAL[s.cal].bg + '; color: ' + CAL[s.cal].fg + ';',
        }));
        if (seen.length > 3) marks.push({ key: 'more', text: '+' + (seen.length - 3), style: 'font-size: 10px; font-weight: 700; color: ${MUTED};' });
      }

      return {
        key: iso,
        num: String(num(iso)),
        style: 'height: ' + CELL_H + 'px; display: flex; flex-direction: column; align-items: stretch; justify-content: ' + (MODE === 'dots' ? 'center' : 'flex-start') + '; gap: ' + (MODE === 'dots' ? 5 : 3) + 'px; cursor: pointer; border-radius: 10px; overflow: hidden;'
          + (isSel ? ' background: ${TILE}; box-shadow: inset 0 0 0 1.6px ${TINT};' : ''),
        numStyle,
        wrap,
        marks,
        pick: () => this.setState({ sel: iso }),
      };
    });

    const evs = on(sel);
    return {
      cells,
      busy: this.state.busy,
      realStyle: 'flex: 1; text-align: center; font-size: 13.5px; font-weight: 600; padding: 7px 0; border-radius: 8px; cursor: pointer;' + (this.state.busy ? ' color: ${MUTED};' : ' background: ${SURFACE}; color: ${FG}; box-shadow: 0 1px 2px rgba(31,36,33,0.10);'),
      busyStyle: 'flex: 1; text-align: center; font-size: 13.5px; font-weight: 600; padding: 7px 0; border-radius: 8px; cursor: pointer;' + (this.state.busy ? ' background: ${SURFACE}; color: ${FG}; box-shadow: 0 1px 2px rgba(31,36,33,0.10);' : ' color: ${MUTED};'),
      dayLabel: longDate(sel).toUpperCase(),
      empty: evs.length === 0,
      events: evs.map((e, i) => ({
        key: i,
        title: e.title,
        meta: timeOf(e) + ' \\u00b7 ' + CAL[e.cal].name,
        bar: 'width: 3px; align-self: stretch; margin: 9px 0; border-radius: 2px; flex: none; background: ' + CAL[e.cal].fg + ';',
        who: e.who.map((k) => ({ key: k, text: k, style: 'width: 21px; height: 21px; border-radius: 999px; background: ${SURFACE}; border: 1.4px solid ' + CAL[e.cal].fg + '; color: ' + CAL[e.cal].fg + '; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none;' })),
      })),
      real: () => this.setState({ busy: false }),
      dense: () => this.setState({ busy: true }),
    };
  }
}`

const legend = `  <div style="flex: none; display: flex; align-items: center; gap: 14px; padding: 2px 16px 10px;">
${Object.values(CAL)
  .map(
    (c) =>
      `    <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: ${MUTED};"><span style="width: 8px; height: 8px; border-radius: 999px; background: ${c.fg};"></span>${c.name}</span>`,
  )
  .join('\n')}
  </div>`

const body = (cellH) => `${STATUS}
${topActions(ic(P.plus, { size: 24, color: TINT, sw: 2.2 }))}
  <div style="flex: none; display: flex; align-items: center; height: 44px; padding: 0 16px;">
    <span style="font-size: 24px; font-weight: 800; letter-spacing: -0.6px;">September</span>
    <span style="font-size: 24px; font-weight: 400; letter-spacing: -0.6px; color: ${MUTED}; margin-left: 5px;">2026</span>
    <div style="flex: 1;"></div>
    <span style="font-size: 15.5px; font-weight: 600; color: ${TINT}; cursor: pointer;">Today</span>
  </div>
${legend}
${weekdayStrip('0 10px')}
  <div style="flex: none; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; padding: 0 10px;">
    <sc-for list="{{ cells }}" as="c" hint-placeholder-count="35">
      <div onClick="{{ c.pick }}" style="{{ c.style }}">
        <div style="{{ c.numStyle }}">{{ c.num }}</div>
        <div style="{{ c.wrap }}">
          <sc-for list="{{ c.marks }}" as="m" hint-placeholder-count="2">
            <span style="{{ m.style }}">{{ m.text }}</span>
          </sc-for>
        </div>
      </div>
    </sc-for>
  </div>
  <div style="flex: none; display: flex; gap: 3px; margin: 14px 16px 0; padding: 3px; background: ${TILE}; border-radius: 11px;">
    <div onClick="{{ real }}" style="{{ realStyle }}">A quiet month</div>
    <div onClick="{{ dense }}" style="{{ busyStyle }}">A month they use</div>
  </div>
  <div style="flex: 1; min-height: 0; overflow: hidden; margin-top: 12px; border-top: 1px solid ${BORDER}; background: ${SURFACE};">
    <div style="padding: 12px 16px 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.7px; color: ${MUTED};">{{ dayLabel }}</div>
    <div style="padding: 0 16px;">
      <sc-if value="{{ empty }}" hint-placeholder-val="{{ false }}">
        <div style="font-size: 15px; color: ${MUTED}; padding: 6px 0 14px;">Nothing on.</div>
      </sc-if>
      <sc-for list="{{ events }}" as="e" hint-placeholder-count="2">
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
${tabBar()}
${HOME_BAR(SURFACE)}`

export default {
  'CellA.dc.html': page(body(50), script('dots', 50)),
  'CellB.dc.html': page(body(62), script('bars', 62)),
  'CellC.dc.html': page(body(56), script('people', 56)),
}
