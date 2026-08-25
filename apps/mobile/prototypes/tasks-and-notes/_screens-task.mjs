/** The task detail screen and the edit modes, plus the Add-tab quick action. */
import {
  BORDER, DANGER, DANGER_BG, FG, HOME_BAR, MUTED, P, STATIC, STATUS, SURFACE,
  TILE, TINT, TINT_BG, badge, card, checkbox, ic, label, navBar, page, row,
  scroll, sheet, tabBar,
} from './_kit.mjs'

const screens = {}

const attrRow = (icon, name, value, { last = false, chevron = true, color = FG } = {}) =>
  row(
    `${ic(icon, { size: 19, color: MUTED })}<span style="flex: 1; font-size: 16px;">${name}</span><span style="font-size: 15.5px; color: ${color}; white-space: nowrap;">${value}</span>${chevron ? ic(P.chevronR, { size: 17, color: '#a9aeaa', sw: 2.2 }) : ''}`,
    { min: 56, last },
  )

const titleCard = (title, done = false) =>
  `    <div style="background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 16px; padding: 16px 15px; display: flex; gap: 12px; align-items: flex-start;">
      <div style="margin-top: 3px;">${checkbox(done)}</div>
      <div style="flex: 1; font-size: 21px; font-weight: 700; line-height: 28px; letter-spacing: -0.4px; text-wrap: pretty;">${title}</div>
    </div>`

const deleteRow = () =>
  `    ${card(row(`${ic(P.trash, { size: 19, color: DANGER })}<span style="flex: 1; font-size: 16px; color: ${DANGER};">Delete task</span>`, { min: 54, last: true }))}`

const meta = (text) =>
  `    <div style="font-size: 12.5px; color: ${MUTED}; padding: 0 2px;">${text}</div>`

/* ── THE MIX — Task detail ───────────────────────────────────────────── */
/* The screen owns everything (A), but each attribute opens the platform's own
   sheet instead of an inline control (B's form, unbundled). No Save button:
   back is done. Tap Due date or Priority. */
screens['MixTask.dc.html'] = page(
  `${STATUS}
${navBar('Household', 'Task', ic(P.more, { size: 22, color: TINT }))}
${scroll(
  `${titleCard('Call the plumber about the radiator')}

    ${card(
      `<div onClick="{{ openDue }}" style="cursor: pointer;">${attrRow(P.calendar, 'Due date', '{{ dueValue }}', { color: '{{ dueColor }}' })}</div>
      <div onClick="{{ openPriority }}" style="cursor: pointer;">${attrRow(P.flag, 'Priority', '{{ priorityValue }}', { color: '{{ priorityColor }}' })}</div>
      ${attrRow(P.tag, 'Labels', 'house', { last: true })}`,
    )}

    ${card(attrRow(P.listChecks, 'List', 'Household', { last: true }))}

${meta('Added by Anne · 3 days ago')}

${deleteRow()}`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}

  <sc-if value="{{ dueOpen }}" hint-placeholder-val="{{ false }}">
${sheet(
  `      <div style="font-size: 21px; font-weight: 700; letter-spacing: -0.4px;">Due date</div>
      <div style="display: flex; gap: 8px;">
        <sc-for list="{{ shortcuts }}" as="s" hint-placeholder-count="4">
          <span onClick="{{ s.pick }}" style="{{ s.style }}">{{ s.name }}</span>
        </sc-for>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 4px;">
          <span style="font-size: 15.5px; font-weight: 700;">{{ monthName }}</span>
          <div style="display: flex; gap: 20px;"><div onClick="{{ prevMonth }}" style="cursor: pointer;">${ic(P.chevronL, { size: 18, color: TINT, sw: 2.2 })}</div><div onClick="{{ nextMonth }}" style="cursor: pointer;">${ic(P.chevronR, { size: 18, color: TINT, sw: 2.2 })}</div></div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px;">
          <sc-for list="{{ weekdays }}" as="w" hint-placeholder-count="7">
            <div style="text-align: center; font-size: 11px; font-weight: 700; color: ${MUTED};">{{ w }}</div>
          </sc-for>
          <sc-for list="{{ days }}" as="d" hint-placeholder-count="35">
            <div onClick="{{ d.pick }}" style="{{ d.style }}">{{ d.n }}</div>
          </sc-for>
        </div>
      </div>
      <div onClick="{{ close }}" style="min-height: 50px; border-radius: 12px; background: ${TINT}; color: ${SURFACE}; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; cursor: pointer;">Done</div>`,
  '{{ close }}',
)}
  </sc-if>

  <sc-if value="{{ priorityOpen }}" hint-placeholder-val="{{ false }}">
${sheet(
  `      <div style="font-size: 21px; font-weight: 700; letter-spacing: -0.4px;">Priority</div>
      <div style="display: flex; flex-direction: column;">
        <sc-for list="{{ priorityOptions }}" as="p" hint-placeholder-count="5">
          <div onClick="{{ p.pick }}" style="display: flex; align-items: center; gap: 11px; min-height: 54px; border-bottom: 1px solid ${BORDER}; cursor: pointer;">
            <div style="{{ p.flagStyle }}">${ic(P.flag, { size: 18, color: 'currentColor', sw: 2.1 })}</div>
            <span style="flex: 1; font-size: 16px;">{{ p.name }}</span>
            <div style="{{ p.checkStyle }}">${ic(P.check, { size: 19, color: TINT, sw: 2.4 })}</div>
          </div>
        </sc-for>
      </div>
      <div onClick="{{ close }}" style="min-height: 50px; border-radius: 12px; background: ${TILE}; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; cursor: pointer;">Done</div>`,
  '{{ close }}',
)}
  </sc-if>`,
  `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sheet: null, day: 19, month: 7, priority: 1 };
  }

  renderVals() {
    const CHECK_ON = 'width:22px;height:22px;display:flex;align-items:center;justify-content:center;';
    const CHECK_OFF = CHECK_ON + 'opacity:0;';
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    // 1 Aug 2026 is a Saturday, so August starts five columns in on a
    // Monday-first grid. Only August is drawn honestly; the arrows just move
    // the label and the length, which is enough to judge the control.
    const OFFSETS = [3, 6, 6, 2, 4, 0, 2, 5, 1, 3, 6, 1];
    const pris = [
      { id: 1, name: 'P1 — urgent', color: '${DANGER}' },
      { id: 2, name: 'P2', color: '#b4791f' },
      { id: 3, name: 'P3', color: '${MUTED}' },
      { id: 4, name: 'P4', color: '${MUTED}' },
      { id: 0, name: 'No priority', color: '#c8ccc9' }
    ];
    const pri = pris.filter((p) => p.id === this.state.priority)[0];
    const month = this.state.month;
    const day = this.state.day;
    // "Today" in these fixtures is 22 August 2026.
    const overdue = month === 7 && day > 0 && day < 22;

    const cells = [];
    for (let i = 0; i < OFFSETS[month]; i++) cells.push({ n: '', blank: true });
    for (let n = 1; n <= LENGTHS[month]; n++) cells.push({ n: String(n), blank: false });
    const DAY = 'height:34px;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:14px;cursor:pointer;';

    const shortcuts = [
      { id: 'today', name: 'Today', month: 7, day: 22 },
      { id: 'tomorrow', name: 'Tomorrow', month: 7, day: 23 },
      { id: 'weekend', name: 'Weekend', month: 7, day: 29 },
      { id: 'none', name: 'None', month: 7, day: 0 }
    ];

    return {
      dueValue: day === 0 ? 'None' : (overdue ? 'Overdue · ' + day + ' Aug' : day + ' ' + MONTHS[month].slice(0, 3)),
      dueColor: overdue ? '${DANGER}' : '${FG}',
      priorityValue: pri.id === 0 ? 'None' : pri.name.split(' ')[0],
      priorityColor: pri.id === 1 ? '${DANGER}' : '${FG}',
      dueOpen: this.state.sheet === 'due',
      priorityOpen: this.state.sheet === 'priority',
      openDue: () => this.setState({ sheet: 'due' }),
      openPriority: () => this.setState({ sheet: 'priority' }),
      close: () => this.setState({ sheet: null }),
      monthName: MONTHS[month] + ' 2026',
      weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      prevMonth: () => this.setState({ month: (month + 11) % 12 }),
      nextMonth: () => this.setState({ month: (month + 1) % 12 }),
      shortcuts: shortcuts.map((s) => ({
        name: s.name,
        style: (day === s.day && month === s.month)
          ? 'font-size:13.5px;font-weight:700;padding:8px 14px;border-radius:999px;background:${TINT};color:${SURFACE};cursor:pointer;'
          : 'font-size:13.5px;font-weight:600;padding:8px 14px;border-radius:999px;background:${TILE};color:${FG};cursor:pointer;',
        pick: () => this.setState({ month: s.month, day: s.day })
      })),
      days: cells.map((c) => ({
        n: c.n,
        style: c.blank
          ? DAY + 'cursor:default;'
          : (Number(c.n) === day
              ? DAY + 'background:${TINT};color:${SURFACE};font-weight:700;'
              : DAY + 'color:${FG};'),
        pick: c.blank ? null : (() => this.setState({ day: Number(c.n) }))
      })),
      priorityOptions: pris.map((p) => ({
        name: p.name,
        flagStyle: 'display:flex;color:' + p.color + ';',
        checkStyle: this.state.priority === p.id ? CHECK_ON : CHECK_OFF,
        pick: () => this.setState({ priority: p.id })
      }))
    };
  }
}`,
)

/* ── A — The detail screen owns everything, inline ───────────────────── */
screens['TaskA.dc.html'] = page(
  `${STATUS}
${navBar('Household', 'Task', '')}
${scroll(
  `${titleCard('Call the plumber about the radiator')}

    <div style="display: flex; flex-direction: column; gap: 9px;">
      ${label('PRIORITY')}
      <div style="display: flex; background: ${TILE}; border-radius: 11px; padding: 3px;">
        <sc-for list="{{ priorities }}" as="p" hint-placeholder-count="5">
          <div onClick="{{ p.pick }}" style="{{ p.style }}">{{ p.name }}</div>
        </sc-for>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 9px;">
      ${label('DUE DATE')}
      <div style="background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 16px; padding: 13px 12px 14px; display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0 4px;">
          <span style="font-size: 15px; font-weight: 700;">August 2026</span>
          <div style="display: flex; gap: 16px;">${ic(P.chevronL, { size: 17, color: TINT, sw: 2.2 })}${ic(P.chevronR, { size: 17, color: TINT, sw: 2.2 })}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px;">
          <sc-for list="{{ weekdays }}" as="w" hint-placeholder-count="7">
            <div style="text-align: center; font-size: 11px; font-weight: 700; color: ${MUTED};">{{ w }}</div>
          </sc-for>
          <sc-for list="{{ days }}" as="d" hint-placeholder-count="35">
            <div onClick="{{ d.pick }}" style="{{ d.style }}">{{ d.n }}</div>
          </sc-for>
        </div>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 9px;">
      ${label('LABELS')}
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        <sc-for list="{{ labels }}" as="l" hint-placeholder-count="4">
          <span onClick="{{ l.pick }}" style="{{ l.style }}">{{ l.name }}</span>
        </sc-for>
        <span style="font-size: 13.5px; font-weight: 600; padding: 7px 13px; border-radius: 999px; border: 1px dashed ${BORDER}; color: ${MUTED};">+ New</span>
      </div>
    </div>

${deleteRow()}`,
  '12px 16px 0',
  18,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
  `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { priority: 1, day: 19, labels: { house: true } };
  }

  renderVals() {
    const names = ['None', 'P1', 'P2', 'P3', 'P4'];
    const SEG_ON = 'flex:1;text-align:center;font-size:14px;font-weight:700;padding:9px 0;border-radius:9px;background:${SURFACE};color:${FG};box-shadow:0 1px 3px rgba(31,36,33,0.12);cursor:pointer;';
    const SEG_OFF = 'flex:1;text-align:center;font-size:14px;font-weight:600;padding:9px 0;border-radius:9px;color:${MUTED};cursor:pointer;';
    const days = [];
    for (let i = 0; i < 5; i++) days.push({ n: '', blank: true });
    for (let n = 1; n <= 31; n++) days.push({ n: String(n), blank: false });
    const DAY = 'height:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:13.5px;cursor:pointer;';
    return {
      weekdays: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      priorities: names.map((name, i) => ({
        name: name,
        style: this.state.priority === i ? SEG_ON : SEG_OFF,
        pick: () => this.setState({ priority: i })
      })),
      days: days.map((d) => ({
        n: d.n,
        style: d.blank
          ? DAY + 'cursor:default;'
          : (Number(d.n) === this.state.day
              ? DAY + 'background:${TINT};color:${SURFACE};font-weight:700;'
              : DAY + 'color:${FG};'),
        pick: d.blank ? null : (() => this.setState({ day: Number(d.n) }))
      })),
      labels: ['house', 'car', 'admin', 'garden'].map((name) => ({
        name: name,
        style: this.state.labels[name]
          ? 'font-size:13.5px;font-weight:600;padding:7px 13px;border-radius:999px;background:${TINT};color:${SURFACE};cursor:pointer;'
          : 'font-size:13.5px;font-weight:600;padding:7px 13px;border-radius:999px;background:${SURFACE};color:${FG};border:1px solid ${BORDER};cursor:pointer;',
        pick: () => {
          const next = Object.assign({}, this.state.labels);
          next[name] = !next[name];
          this.setState({ labels: next });
        }
      }))
    };
  }
}`,
)

/* ── B — Read-only screen, edit in a sheet ───────────────────────────── */
screens['TaskB.dc.html'] = page(
  `${STATUS}
${navBar('Household', 'Task', '<span onClick="{{ open }}" style="font-size: 17px; color: ' + TINT + '; cursor: pointer;">Edit</span>')}
${scroll(
  `${titleCard('Call the plumber about the radiator')}

    ${card(
      `${attrRow(P.calendar, 'Due date', 'Overdue · 19 Aug', { chevron: false, color: DANGER })}
      ${attrRow(P.flag, 'Priority', 'P1', { chevron: false, color: DANGER })}
      ${attrRow(P.tag, 'Labels', 'house', { chevron: false })}
      ${attrRow(P.listChecks, 'List', 'Household', { chevron: false, last: true })}`,
    )}

${meta('Added by Anne · 3 days ago · last changed by Eric yesterday')}

    ${card(
      row(`${ic(P.check, { size: 19, color: TINT, sw: 2.2 })}<span style="flex: 1; font-size: 16px; color: ${TINT};">Mark complete</span>`, { min: 54 }) +
        row(`${ic(P.trash, { size: 19, color: DANGER })}<span style="flex: 1; font-size: 16px; color: ${DANGER};">Delete task</span>`, { min: 54, last: true }),
    )}`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}

  <sc-if value="{{ isOpen }}" hint-placeholder-val="{{ false }}">
${sheet(
  `      <div style="display: flex; align-items: center;">
        <div onClick="{{ close }}" style="flex: 1; font-size: 17px; color: ${TINT}; cursor: pointer;">Cancel</div>
        <div style="font-size: 17px; font-weight: 700;">Edit task</div>
        <div onClick="{{ close }}" style="flex: 1; text-align: right; font-size: 17px; font-weight: 700; color: ${TINT}; cursor: pointer;">Save</div>
      </div>
      <div style="background: ${TILE}; border-radius: 12px; padding: 13px 14px; font-size: 16px; line-height: 22px; border: 1.5px solid ${TINT};">Call the plumber about the radiator</div>
      ${card(
        `${attrRow(P.calendar, 'Due date', '19 Aug')}
      ${attrRow(P.flag, 'Priority', 'P1')}
      ${attrRow(P.tag, 'Labels', 'house', { last: true })}`,
      )}
      <div style="font-size: 12.5px; line-height: 18px; color: ${MUTED};">Nothing is written until Save. This is the same form the composer's “Add with details” opens.</div>`,
  '{{ close }}',
)}
  </sc-if>`,
  `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { open: false };
  }

  renderVals() {
    return {
      isOpen: this.state.open,
      open: () => this.setState({ open: true }),
      close: () => this.setState({ open: false })
    };
  }
}`,
)

/* ── C — No detail screen; the row is the editor ─────────────────────── */
const cListRow = (title, last = false) =>
  row(
    `${checkbox(false)}<span style="flex: 1; font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</span>`,
    { min: 54, last },
  )

screens['TaskC.dc.html'] = page(
  `${STATUS}
${navBar('Tasks', 'Household', ic(P.more, { size: 22, color: TINT }))}
  <div style="flex: 1; min-height: 0; overflow: hidden; padding: 12px 16px 0; display: flex; flex-direction: column; gap: 14px; {{ blurStyle }}">
    ${card(
      `${cListRow('Pick up the parcel from the DHL point')}
      ${cListRow("Renew Emma's passport")}
      ${cListRow('Book the MOT')}
      ${cListRow('Water the plants on the landing')}
      ${cListRow('Ask the neighbours about the fence', true)}`,
    )}
  </div>
${tabBar('all')}
${HOME_BAR(SURFACE)}

  <div style="position: absolute; left: 16px; right: 16px; top: 111px;">
    <sc-if value="{{ renaming }}" hint-placeholder-val="{{ false }}">
      <div style="background: ${SURFACE}; border: 1.5px solid ${TINT}; border-radius: 14px; padding: 0 13px; display: flex; align-items: center; gap: 11px; min-height: 56px; box-shadow: 0 8px 22px rgba(31,36,33,0.16);">
        ${checkbox(false)}
        <span style="flex: 1; font-size: 15.5px;">Call the plumber about the radiator<span style="display: inline-block; width: 2px; height: 18px; background: ${TINT}; vertical-align: -3px; margin-left: 1px;"></span></span>
        <span onClick="{{ reset }}" style="font-size: 15px; font-weight: 700; color: ${TINT}; cursor: pointer;">Done</span>
      </div>
    </sc-if>
    <sc-if value="{{ menuing }}" hint-placeholder-val="{{ true }}">
      <div style="background: ${SURFACE}; border-radius: 14px; padding: 0 13px; display: flex; align-items: center; gap: 11px; min-height: 56px; box-shadow: 0 10px 26px rgba(31,36,33,0.2);">
        ${checkbox(false)}
        <span style="flex: 1; font-size: 15.5px; font-weight: 600;">Call the plumber about the radiator</span>
      </div>
      <div style="margin-top: 10px; background: rgba(255,255,255,0.97); border-radius: 14px; overflow: hidden; box-shadow: 0 10px 26px rgba(31,36,33,0.2);">
        <div onClick="{{ rename }}" style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 46px; border-bottom: 1px solid ${BORDER}; cursor: pointer;"><span style="font-size: 16px;">Rename</span>${ic(P.pencil, { size: 18, color: FG })}</div>
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 46px; border-bottom: 1px solid ${BORDER};"><span style="font-size: 16px;">Due date</span>${ic(P.calendar, { size: 18, color: FG })}</div>
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 46px; border-bottom: 1px solid ${BORDER};"><span style="font-size: 16px;">Priority</span>${ic(P.flag, { size: 18, color: FG })}</div>
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 46px; border-bottom: 1px solid ${BORDER};"><span style="font-size: 16px;">Labels</span>${ic(P.tag, { size: 18, color: FG })}</div>
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 46px;"><span style="font-size: 16px; color: ${DANGER};">Delete</span>${ic(P.trash, { size: 18, color: DANGER })}</div>
      </div>
    </sc-if>
  </div>

  <sc-if value="{{ menuing }}" hint-placeholder-val="{{ true }}">
    <div onClick="{{ reset }}" style="position: absolute; left: 0; right: 0; bottom: 24px; display: flex; justify-content: center;">
      <span style="font-size: 12.5px; color: ${MUTED}; background: rgba(255,255,255,0.9); border-radius: 999px; padding: 6px 14px;">Tap Rename to see the row become the field</span>
    </div>
  </sc-if>`,
  `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { mode: 'menu' };
  }

  renderVals() {
    return {
      menuing: this.state.mode === 'menu',
      renaming: this.state.mode === 'rename',
      blurStyle: this.state.mode === 'menu' ? 'filter: blur(3px); opacity: 0.55;' : '',
      rename: () => this.setState({ mode: 'rename' }),
      reset: () => this.setState({ mode: this.state.mode === 'menu' ? 'rename' : 'menu' })
    };
  }
}`,
)

/* ── The Add tab's task quick action ─────────────────────────────────── */
screens['QuickAdd.dc.html'] = page(
  `${STATUS}
  <div style="flex: 1; min-height: 0; padding: 0 16px; display: flex; flex-direction: column; justify-content: flex-start; gap: 14px; padding-top: 20px; opacity: 0.5;">
    <div style="font-size: 32px; font-weight: 800; letter-spacing: -0.9px;">Home</div>
    <div style="height: 96px; border-radius: 16px; background: ${SURFACE}; border: 1px solid ${BORDER};"></div>
    <div style="height: 96px; border-radius: 16px; background: ${SURFACE}; border: 1px solid ${BORDER};"></div>
  </div>
${tabBar('add')}
${HOME_BAR(SURFACE)}

  <div style="position: absolute; left: 0; top: 0; right: 0; bottom: 0; background: rgba(31, 36, 33, 0.34);"></div>
  <div style="position: absolute; left: 0; right: 0; bottom: 0; background: ${SURFACE}; border-radius: 20px 20px 0 0; padding: 12px 16px 30px; display: flex; flex-direction: column; gap: 14px;">
    <div style="width: 38px; height: 4px; border-radius: 2px; background: ${BORDER}; align-self: center;"></div>
    <div style="font-size: 21px; font-weight: 700; letter-spacing: -0.4px;">Add</div>

    <div style="background: ${SURFACE}; border: 1.5px solid ${TINT}; border-radius: 12px; padding: 0 13px; display: flex; align-items: center; gap: 11px; min-height: 50px;">
      ${ic(P.listChecks, { size: 19, color: TINT })}
      <span style="flex: 1; font-size: 16px;">Order more coffee<span style="display: inline-block; width: 2px; height: 18px; background: ${TINT}; vertical-align: -3px; margin-left: 1px;"></span></span>
    </div>

    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 13.5px; color: ${MUTED};">Goes in</span>
      <span onClick="{{ openPicker }}" style="display: flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 700; color: ${TINT}; background: ${TINT_BG}; border-radius: 999px; padding: 6px 12px; cursor: pointer;">{{ listName }}${ic(P.chevronD, { size: 15, color: TINT, sw: 2.2 })}</span>
      <span style="font-size: 12.5px; color: ${MUTED};">{{ why }}</span>
    </div>

    <sc-if value="{{ pickerOpen }}" hint-placeholder-val="{{ false }}">
      <div style="border: 1px solid ${BORDER}; border-radius: 14px; overflow: hidden;">
        <sc-for list="{{ options }}" as="o" hint-placeholder-count="4">
          <div onClick="{{ o.pick }}" style="display: flex; align-items: center; gap: 11px; padding: 0 13px; min-height: 48px; border-bottom: 1px solid ${BORDER}; cursor: pointer;">
            <span style="flex: 1; font-size: 15.5px;">{{ o.name }}</span>
            <div style="{{ o.checkStyle }}">${ic(P.check, { size: 18, color: TINT, sw: 2.4 })}</div>
          </div>
        </sc-for>
      </div>
    </sc-if>

    <div style="display: flex; gap: 10px;">
      <div style="flex: 1; min-height: 50px; border-radius: 12px; background: ${TILE}; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700;">Cancel</div>
      <div style="flex: 2; min-height: 50px; border-radius: 12px; background: ${TINT}; color: ${SURFACE}; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700;">Add task</div>
    </div>

    <div style="display: flex; gap: 22px; padding-top: 2px; border-top: 1px solid ${BORDER}; padding-top: 14px;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: 5px; color: ${MUTED};">${ic(P.chef, { size: 21, color: 'currentColor' })}<span style="font-size: 11px;">Recipe</span></div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 5px; color: ${MUTED};">${ic(P.baby, { size: 21, color: 'currentColor' })}<span style="font-size: 11px;">Baby</span></div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 5px; color: ${TINT};">${ic(P.listChecks, { size: 21, color: 'currentColor' })}<span style="font-size: 11px; font-weight: 700;">Task</span></div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 5px; color: ${MUTED};">${ic(P.notebookPen, { size: 21, color: 'currentColor' })}<span style="font-size: 11px;">Note</span></div>
    </div>
  </div>`,
  `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { list: 'Household', picker: false };
  }

  renderVals() {
    const CHECK_ON = 'width:20px;height:20px;display:flex;align-items:center;justify-content:center;';
    const CHECK_OFF = CHECK_ON + 'opacity:0;';
    const names = ['Household', 'Shopping', 'Emma to-dos', 'Emma questions'];
    return {
      listName: this.state.list,
      why: this.state.list === 'Household' ? 'last list you added to' : '',
      pickerOpen: this.state.picker,
      openPicker: () => this.setState({ picker: !this.state.picker }),
      options: names.map((name) => ({
        name: name,
        checkStyle: this.state.list === name ? CHECK_ON : CHECK_OFF,
        pick: () => this.setState({ list: name, picker: false })
      }))
    };
  }
}`,
)

export default screens
