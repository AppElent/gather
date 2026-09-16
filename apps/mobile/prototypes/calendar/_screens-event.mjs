/**
 * ROW 3 — Adding and editing an event.
 *
 * Sheet shape, which fields sit on the screen and which sit behind a picker,
 * and whether there is a Save button at all. `DueDateSheet`'s header comment
 * argues there is not; A disagrees with it in writing, and says why on its
 * own artboard's note.
 *
 * The title field is a real input in all three — click it and type.
 */
import {
  BG,
  BORDER,
  CAL,
  DANGER,
  FG,
  HOME_BAR,
  MEM,
  MUTED,
  P,
  STATUS,
  SURFACE,
  TILE,
  TINT,
  WEEKDAYS,
  card,
  dayNum,
  ic,
  monthGrid,
  page,
  row,
  sheet,
  tabBar,
} from './_kit.mjs'

const weeks = monthGrid(2026, 8).weeks.filter((w) => w.some(Boolean))

const swatch = (cal, size = 12) =>
  `<span style="width: ${size}px; height: ${size}px; border-radius: 4px; background: ${CAL[cal].fg}; flex: none;"></span>`

const rowLabel = (text) =>
  `<span style="font-size: 16px; color: ${FG};">${text}</span>`

const rowValue = (text, color = MUTED) =>
  `<span style="font-size: 16px; color: ${color};">${text}</span>`

/* ══ A — A pushed form, with a Save ════════════════════════════════════ */

const scriptA = `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { title: '', allDay: false, who: ['M'] };
  }
  renderVals() {
    const has = this.state.title.trim().length > 0;
    const toggle = (k) => () => {
      const w = this.state.who.includes(k)
        ? this.state.who.filter((x) => x !== k)
        : this.state.who.concat(k);
      this.setState({ who: w });
    };
    return {
      saveStyle: 'font-size: 17px; font-weight: 700;' + (has ? ' color: ${TINT}; cursor: pointer;' : ' color: ${MUTED}; opacity: 0.5;'),
      timed: !this.state.allDay,
      allDay: this.state.allDay,
      knob: 'width: 51px; height: 31px; border-radius: 999px; flex: none; display: flex; align-items: center; padding: 2px; cursor: pointer; transition: background 120ms; background: ' + (this.state.allDay ? '${TINT}' : '#d9dbd7') + ';',
      knobDot: 'width: 27px; height: 27px; border-radius: 999px; background: ${SURFACE}; box-shadow: 0 1px 3px rgba(31,36,33,0.28); transition: margin 120ms; margin-left: ' + (this.state.allDay ? '20px' : '0') + ';',
      people: ${JSON.stringify(Object.keys(MEM))}.map((k) => {
        const isOn = this.state.who.includes(k);
        return {
          key: k, text: k, name: ${JSON.stringify(MEM)}[k],
          style: 'display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer;',
          circle: 'width: 44px; height: 44px; border-radius: 999px; font-size: 17px; font-weight: 700; display: flex; align-items: center; justify-content: center;'
            + (isOn ? ' background: ${TINT}; color: ${SURFACE};' : ' background: ${TILE}; color: ${MUTED};'),
          nameStyle: 'font-size: 11.5px;' + (isOn ? ' color: ${FG}; font-weight: 600;' : ' color: ${MUTED};'),
          pick: toggle(k),
        };
      }),
      onTitle: (e) => this.setState({ title: e.target.value }),
      flip: () => this.setState({ allDay: !this.state.allDay }),
    };
  }
}`

const EventA = page(
  `${STATUS}
  <div style="flex: none; display: flex; align-items: center; height: 52px; padding: 0 16px;">
    <div style="flex: 1; font-size: 17px; color: ${TINT}; cursor: pointer;">Cancel</div>
    <div style="font-size: 17px; font-weight: 700; letter-spacing: -0.3px;">New event</div>
    <div style="flex: 1; text-align: right;"><span style="{{ saveStyle }}">Save</span></div>
  </div>
  <div style="flex: 1; min-height: 0; overflow: hidden; padding: 8px 16px 0; display: flex; flex-direction: column; gap: 18px;">
    ${card(
      `${row(
        `<input class="f" onInput="{{ onTitle }}" placeholder="Title" style="font-size: 17px;">`,
        { min: 58 },
      )}
      ${row(
        `${ic(P.pin, { size: 19, color: MUTED })}<input class="f" placeholder="Location" style="font-size: 16px;">`,
        { min: 54, last: true },
      )}`,
    )}
    ${card(
      `${row(
        `${rowLabel('Calendar')}<div style="flex: 1;"></div>${swatch('house')}${rowValue('Household')}${ic(P.chevronR, { size: 18, color: MUTED })}`,
      )}
      ${row(`${rowLabel('All-day')}<div style="flex: 1;"></div><div onClick="{{ flip }}" style="{{ knob }}"><span style="{{ knobDot }}"></span></div>`)}
      <sc-if value="{{ timed }}" hint-placeholder-val="{{ true }}">
        <div>
          ${row(`${rowLabel('Starts')}<div style="flex: 1;"></div>${rowValue('Wed 2 Sep')}${rowValue('14:30', FG)}`)}
          ${row(`${rowLabel('Ends')}<div style="flex: 1;"></div>${rowValue('Wed 2 Sep')}${rowValue('15:15', FG)}`, { last: true })}
        </div>
      </sc-if>
      <sc-if value="{{ allDay }}" hint-placeholder-val="{{ false }}">
        ${row(`${rowLabel('Date')}<div style="flex: 1;"></div>${rowValue('Wed 2 Sep', FG)}`, { last: true })}
      </sc-if>`,
    )}
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: ${MUTED}; padding-left: 2px;">WHO HAS TO BE THERE</div>
      ${card(
        `<div style="display: flex; gap: 22px; padding: 14px 2px;">
          <sc-for list="{{ people }}" as="p" hint-placeholder-count="3">
            <div onClick="{{ p.pick }}" style="{{ p.style }}">
              <div style="{{ p.circle }}">{{ p.text }}</div>
              <div style="{{ p.nameStyle }}">{{ p.name }}</div>
            </div>
          </sc-for>
        </div>`,
      )}
    </div>
    ${card(
      `<div style="padding: 14px 0; min-height: 62px;"><input class="f" placeholder="Notes" style="font-size: 16px;"></div>`,
    )}
  </div>
${HOME_BAR()}`,
  scriptA,
)

/* ══ B — One sheet, chips, no Save ═════════════════════════════════════ */

/* The calendar behind the sheet — B's whole claim is that the sheet sits over
 * the thing you were looking at, so it has to be drawn. */
const behind = `  <div style="flex: none; display: flex; align-items: center; height: 44px; padding: 0 16px;">
    <span style="font-size: 26px; font-weight: 800; letter-spacing: -0.7px;">September</span>
    <span style="font-size: 26px; font-weight: 400; letter-spacing: -0.7px; color: ${MUTED}; margin-left: 6px;">2026</span>
  </div>
  <div style="flex: none; background: ${SURFACE}; border-bottom: 1px solid ${BORDER};">
    <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); padding: 4px 10px 0;">${WEEKDAYS.map(
      (d) =>
        `<div style="text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: ${MUTED}; padding: 4px 0 6px;">${d}</div>`,
    ).join('')}</div>
    <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; padding: 0 10px 10px;">${weeks[0]
      .map((iso) =>
        iso === null
          ? '<div style="height: 46px;"></div>'
          : `<div style="height: 46px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;"><span style="font-size: 16.5px; width: 29px; height: 29px; display: flex; align-items: center; justify-content: center; border-radius: 999px;${iso === '2026-09-02' ? ` background: ${TINT}; color: ${SURFACE}; font-weight: 700;` : ` color: ${FG};`}">${dayNum(iso)}</span></div>`,
      )
      .join('')}</div>
  </div>
  <div style="flex: 1;"></div>`

const dueGrid = `<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px;">${weeks
  .flat()
  .map((iso) =>
    iso === null
      ? '<div style="height: 40px;"></div>'
      : `<div style="height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer;"><span style="font-size: 16px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 999px;${iso === '2026-09-02' ? ` background: ${TINT}; color: ${SURFACE}; font-weight: 700;` : ` color: ${FG};`}">${dayNum(iso)}</span></div>`,
  )
  .join('')}</div>`

const scriptB = `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { pane: 'chips' };
  }
  renderVals() {
    const p = this.state.pane;
    const chipStyle = (isOn) => 'display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 600; padding: 8px 13px; border-radius: 999px; white-space: nowrap; cursor: pointer;'
      + (isOn ? ' background: ${TINT}; color: ${SURFACE};' : ' background: ${SURFACE}; color: ${FG}; border: 1px solid ${BORDER};');
    return {
      chips: p === 'chips',
      date: p === 'date',
      people: p === 'people',
      dateChip: chipStyle(p === 'date'),
      whoChip: chipStyle(p === 'people'),
      open: (pane) => () => this.setState({ pane: pane }),
      openDate: () => this.setState({ pane: this.state.pane === 'date' ? 'chips' : 'date' }),
      openWho: () => this.setState({ pane: this.state.pane === 'people' ? 'chips' : 'people' }),
      back: () => this.setState({ pane: 'chips' }),
    };
  }
}`

const EventB = page(
  `${STATUS}
${behind}
${HOME_BAR()}
${sheet(
  `      <div style="display: flex; align-items: center; gap: 12px;">
        <input class="f" value="Dentist — Mila" style="font-size: 20px; font-weight: 700; letter-spacing: -0.4px; flex: 1;">
        <span style="cursor: pointer; flex: none;">${ic(P.x, { size: 22, color: MUTED, sw: 2 })}</span>
      </div>
      <sc-if value="{{ chips }}" hint-placeholder-val="{{ true }}">
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 600; padding: 8px 13px; border-radius: 999px; background: ${CAL.house.bg}; color: ${CAL.house.fg}; cursor: pointer;">${swatch('house', 10)}Household</span>
          <span onClick="{{ openDate }}" style="{{ dateChip }}">Wed 2 Sep</span>
          <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 600; padding: 8px 13px; border-radius: 999px; background: ${SURFACE}; color: ${FG}; border: 1px solid ${BORDER}; cursor: pointer;">14:30 – 15:15</span>
          <span onClick="{{ openWho }}" style="{{ whoChip }}">S · M</span>
          <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 13.5px; font-weight: 600; padding: 8px 13px; border-radius: 999px; background: ${SURFACE}; color: ${MUTED}; border: 1px dashed ${BORDER}; cursor: pointer;">${ic(P.plus, { size: 14, color: MUTED, sw: 2.4 })}Where</span>
          <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 13.5px; font-weight: 600; padding: 8px 13px; border-radius: 999px; background: ${SURFACE}; color: ${MUTED}; border: 1px dashed ${BORDER}; cursor: pointer;">${ic(P.plus, { size: 14, color: MUTED, sw: 2.4 })}Notes</span>
        </div>
        <div style="display: flex; align-items: center; gap: 9px; border-top: 1px solid ${BORDER}; padding-top: 12px; cursor: pointer;">
          ${ic(P.notebookPen, { size: 18, color: DANGER })}<span style="font-size: 15.5px; color: ${DANGER};">Delete event</span>
        </div>
      </sc-if>
      <sc-if value="{{ date }}" hint-placeholder-val="{{ false }}">
        <div>
          <div style="display: flex; gap: 8px; padding-bottom: 12px;">
            <span style="flex: 1; text-align: center; font-size: 13.5px; font-weight: 600; padding: 9px 0; border-radius: 12px; border: 1px solid ${BORDER}; cursor: pointer;">Today</span>
            <span style="flex: 1; text-align: center; font-size: 13.5px; font-weight: 600; padding: 9px 0; border-radius: 12px; border: 1px solid ${BORDER}; cursor: pointer;">Tomorrow</span>
            <span style="flex: 1; text-align: center; font-size: 13.5px; font-weight: 600; padding: 9px 0; border-radius: 12px; border: 1px solid ${BORDER}; cursor: pointer;">Weekend</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px;">
            <span style="cursor: pointer;">${ic(P.chevronL, { size: 20, color: FG, sw: 2.2 })}</span>
            <span style="font-size: 16px; font-weight: 600;">September 2026</span>
            <span style="cursor: pointer;">${ic(P.chevronR, { size: 20, color: FG, sw: 2.2 })}</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));">${WEEKDAYS.map(
            (d) =>
              `<div style="text-align: center; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: ${MUTED}; padding-bottom: 4px;">${d}</div>`,
          ).join('')}</div>
          ${dueGrid}
          <div onClick="{{ back }}" style="text-align: center; font-size: 15.5px; font-weight: 600; color: ${TINT}; padding: 12px 0 0; cursor: pointer;">Done</div>
        </div>
      </sc-if>
      <sc-if value="{{ people }}" hint-placeholder-val="{{ false }}">
        <div>
          ${Object.entries(MEM)
            .map(
              ([k, name], i) =>
                `<div style="display: flex; align-items: center; gap: 12px; min-height: 54px;${i === 2 ? '' : ` border-bottom: 1px solid ${BORDER};`} cursor: pointer;">
            <span style="width: 32px; height: 32px; border-radius: 999px; background: ${k === 'E' ? TILE : TINT}; color: ${k === 'E' ? MUTED : SURFACE}; font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none;">${k}</span>
            <span style="flex: 1; font-size: 16px;">${name}</span>
            ${k === 'E' ? '' : ic(P.check, { size: 19, color: TINT, sw: 2.4 })}
          </div>`,
            )
            .join('\n          ')}
          <div onClick="{{ back }}" style="text-align: center; font-size: 15.5px; font-weight: 600; color: ${TINT}; padding: 14px 0 0; cursor: pointer;">Done</div>
        </div>
      </sc-if>`,
)}`,
  scriptB,
)

/* ══ C — Compose in place, on the day ══════════════════════════════════ */

const scriptC = `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { more: false, title: '' };
  }
  renderVals() {
    return {
      more: this.state.more,
      caret: this.state.more ? 'transform: rotate(180deg); transform-origin: center; cursor: pointer;' : 'cursor: pointer;',
      onTitle: (e) => this.setState({ title: e.target.value }),
      flip: () => this.setState({ more: !this.state.more }),
    };
  }
}`

const dayRow = (iso, events, { composer = false } = {}) => `
    <div style="display: flex; gap: 12px; padding: 0 16px; background: ${SURFACE}; border-bottom: 1px solid ${BORDER};">
      <div style="width: 42px; flex: none; padding: 13px 0; text-align: center;">
        <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.6px; color: ${MUTED};">${new Date(2026, 8, dayNum(iso)).toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()}</div>
        <div style="font-size: 21px; font-weight: 700; letter-spacing: -0.4px; margin-top: 2px; color: ${FG};">${dayNum(iso)}</div>
      </div>
      <div style="flex: 1; min-width: 0; padding: 8px 0;">
        ${events
          .map(
            (e) => `<div style="display: flex; align-items: center; gap: 10px; min-height: 44px; border-bottom: 1px solid ${BORDER};">
          <span style="width: 3px; align-self: stretch; margin: 8px 0; border-radius: 2px; background: ${CAL[e.cal].fg}; flex: none;"></span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.title}</div>
            <div style="font-size: 12.5px; color: ${MUTED}; margin-top: 1px;">${e.time} · ${CAL[e.cal].name}</div>
          </div>
        </div>`,
          )
          .join('\n        ')}${
            composer
              ? `
        <div style="display: flex; align-items: center; gap: 10px; min-height: 46px;">
          <span style="width: 3px; align-self: stretch; margin: 8px 0; border-radius: 2px; background: ${CAL.house.fg}; flex: none;"></span>
          <input class="f" onInput="{{ onTitle }}" placeholder="What is it?" style="font-size: 15.5px; flex: 1;">
          <span onClick="{{ flip }}" style="{{ caret }}">${ic(P.chevronD, { size: 20, color: TINT, sw: 2.2 })}</span>
        </div>
        <sc-if value="{{ more }}" hint-placeholder-val="{{ false }}">
          <div style="display: flex; flex-wrap: wrap; gap: 7px; padding: 2px 0 12px 13px;">
            <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 7px 12px; border-radius: 999px; background: ${CAL.house.bg}; color: ${CAL.house.fg}; cursor: pointer;">${swatch('house', 9)}Household</span>
            <span style="font-size: 13px; font-weight: 600; padding: 7px 12px; border-radius: 999px; background: ${SURFACE}; color: ${MUTED}; border: 1px dashed ${BORDER}; cursor: pointer;">All-day</span>
            <span style="font-size: 13px; font-weight: 600; padding: 7px 12px; border-radius: 999px; background: ${SURFACE}; color: ${MUTED}; border: 1px dashed ${BORDER}; cursor: pointer;">+ Time</span>
            <span style="font-size: 13px; font-weight: 600; padding: 7px 12px; border-radius: 999px; background: ${SURFACE}; color: ${MUTED}; border: 1px dashed ${BORDER}; cursor: pointer;">+ Who</span>
          </div>
        </sc-if>`
              : ''
          }
      </div>
    </div>`

const EventC = page(
  `${STATUS}
  <div style="flex: none; display: flex; align-items: center; justify-content: space-between; height: 44px; padding: 0 16px 0 6px;">
    <div style="display: flex; align-items: center; gap: 2px; color: ${TINT};">${ic(P.chevronL, { size: 22, color: TINT, sw: 2 })}<span style="font-size: 17px;">All</span></div>
    <div style="display: flex; align-items: center; gap: 18px;">${ic(P.calendar, { size: 22, color: TINT })}${ic(P.plus, { size: 24, color: TINT, sw: 2.2 })}</div>
  </div>
  <div style="flex: none; padding: 2px 16px 10px;">
    <div style="font-size: 32px; font-weight: 800; letter-spacing: -0.9px;">Calendar</div>
    <div style="font-size: 13.5px; color: ${MUTED}; margin-top: 3px;">Huize Jansen</div>
  </div>
  <div style="flex: 1; min-height: 0; overflow: hidden;">
    <div style="padding: 4px 16px 8px; font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: ${MUTED};">SEPTEMBER 2026</div>
${dayRow('2026-09-02', [{ title: 'Dentist — Mila', cal: 'house', time: '14:30–15:15' }])}
${dayRow('2026-09-03', [{ title: 'Parents’ evening', cal: 'school', time: '19:30–21:00' }])}
${dayRow('2026-09-04', [
  { title: 'Bins out', cal: 'house', time: 'all-day' },
  { title: 'Swimming lesson', cal: 'school', time: '16:00–16:45' },
], { composer: true })}
${dayRow('2026-09-14', [{ title: 'Sanne away — Berlin', cal: 'house', time: 'all-day' }])}
  </div>
${tabBar()}
${HOME_BAR(SURFACE)}`,
  scriptC,
)

export default {
  'EventA.dc.html': EventA,
  'EventB.dc.html': EventB,
  'EventC.dc.html': EventC,
}
