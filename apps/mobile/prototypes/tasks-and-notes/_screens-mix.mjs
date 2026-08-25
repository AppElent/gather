/**
 * THE MIX's list screens — the ones the second round of feedback settled.
 *
 * One list with B's rich rows behind a per-list display setting, the two
 * gestures drawn where a still artboard cannot show them, and a linked
 * (Todoist) list opened, which is where "it behaves like a local list" stops
 * being true.
 */
import {
  BORDER, DANGER, FG, HOME_BAR, MUTED, P, STATUS, SURFACE, TILE, TINT, TINT_BG,
  badge, card, checkbox, ic, label, navBar, page, row, scroll, tabBar,
} from './_kit.mjs'

const screens = {}

const composer = (text = 'Add a task…') =>
  row(
    `${ic(P.plus, { size: 17, color: TINT, sw: 2.2 })}<span style="flex: 1; font-size: 15.5px; color: ${MUTED};">${text}</span>`,
    { min: 50, last: true },
  )

/* ── THE MIX — One list ──────────────────────────────────────────────── */
/* B's rich rows, but WHICH properties a row carries is a setting rather than a
   decision the design makes once for everyone. The ⋯ menu is live: turn Due
   dates, Priority and Labels off one at a time and the rows collapse to A's. */
screens['MixList.dc.html'] = page(
  `${STATUS}
  <div style="flex: none; display: flex; align-items: center; height: 52px; padding: 0 16px 0 8px; gap: 8px;">
    <div style="flex: 1; display: flex; align-items: center; gap: 1px; color: ${TINT}; cursor: pointer;">${ic(P.chevronL, { size: 22, color: TINT, sw: 2 })}<span style="font-size: 17px;">Tasks</span></div>
    <div style="font-size: 17px; font-weight: 700; letter-spacing: -0.3px;">Household</div>
    <div onClick="{{ toggleMenu }}" style="flex: 1; display: flex; justify-content: flex-end; cursor: pointer;">${ic(P.more, { size: 22, color: TINT })}</div>
  </div>
${scroll(
  `    <div style="background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 16px; padding: 0 14px; overflow: hidden;">
      <sc-for list="{{ active }}" as="t" hint-placeholder-count="6">
        <div onClick="{{ t.toggle }}" style="{{ t.rowStyle }}">
          <div style="{{ t.barStyle }}"></div>
          ${checkbox(false)}
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px;">
            <span style="font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ t.title }}</span>
            <sc-if value="{{ t.hasMeta }}" hint-placeholder-val="{{ true }}">
              <div style="display: flex; align-items: center; gap: 7px;">
                <sc-if value="{{ t.showDue }}" hint-placeholder-val="{{ true }}"><span style="{{ t.dueStyle }}">{{ t.due }}</span></sc-if>
                <sc-if value="{{ t.showPri }}" hint-placeholder-val="{{ true }}"><span style="{{ t.priStyle }}">{{ t.pri }}</span></sc-if>
                <sc-if value="{{ t.showTags }}" hint-placeholder-val="{{ true }}"><span style="font-size: 11px; font-weight: 700; color: ${MUTED}; background: ${TILE}; border-radius: 6px; padding: 3px 7px;">{{ t.tags }}</span></sc-if>
              </div>
            </sc-if>
          </div>
        </div>
      </sc-for>

      <div onClick="{{ toggleCompleted }}" style="display: flex; align-items: center; justify-content: space-between; min-height: 48px; border-top: 1px solid ${BORDER}; cursor: pointer;">
        <span style="font-size: 15px; font-weight: 600; color: ${MUTED};">{{ completedLabel }}</span>
        <div style="{{ chevronStyle }}">${ic(P.chevronD, { size: 18, color: MUTED })}</div>
      </div>

      <sc-if value="{{ completedOpen }}" hint-placeholder-val="{{ false }}">
        <sc-for list="{{ completed }}" as="c" hint-placeholder-count="2">
          <div onClick="{{ c.toggle }}" style="display: flex; align-items: center; gap: 11px; min-height: 52px; border-bottom: 1px solid ${BORDER}; cursor: pointer;">
            ${checkbox(true)}
            <span style="flex: 1; font-size: 15.5px; color: ${MUTED}; text-decoration: line-through; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ c.title }}</span>
          </div>
        </sc-for>
      </sc-if>

      ${composer()}
    </div>`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}

  <sc-if value="{{ menuOpen }}" hint-placeholder-val="{{ true }}">
    <div onClick="{{ toggleMenu }}" style="position: absolute; left: 0; top: 0; right: 0; bottom: 0;"></div>
    <div style="position: absolute; right: 12px; top: 96px; width: 252px; background: rgba(255,255,255,0.98); border-radius: 14px; overflow: hidden; box-shadow: 0 12px 30px rgba(31,36,33,0.22);">
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.7px; color: ${MUTED}; padding: 12px 14px 6px;">SHOW ON EACH TASK</div>
      <sc-for list="{{ switches }}" as="s" hint-placeholder-count="3">
        <div onClick="{{ s.toggle }}" style="display: flex; align-items: center; gap: 10px; padding: 0 14px; min-height: 44px; cursor: pointer;">
          <span style="flex: 1; font-size: 15.5px;">{{ s.name }}</span>
          <div style="{{ s.trackStyle }}"><div style="{{ s.knobStyle }}"></div></div>
        </div>
      </sc-for>
      <div style="height: 1px; background: ${BORDER}; margin: 6px 0;"></div>
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 44px;"><span style="font-size: 15.5px;">Reorder</span>${ic(P.grip, { size: 18, color: FG })}</div>
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 44px;"><span style="font-size: 15.5px;">Rename list</span>${ic(P.pencil, { size: 18, color: FG })}</div>
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 44px;"><span style="font-size: 15.5px; color: ${DANGER};">Delete list</span>${ic(P.trash, { size: 18, color: DANGER })}</div>
    </div>
  </sc-if>`,
  `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = {
      done: { bins: true, water: true },
      open: false,
      menu: true,
      show: { due: true, pri: true, tags: true }
    };
  }

  data() {
    return [
      { id: 'plumber', title: 'Call the plumber about the radiator', due: 'Tue', overdue: true, p: 1, tags: 'house' },
      { id: 'parcel', title: 'Pick up the parcel from the DHL point', due: 'Today', p: 0, tags: '' },
      { id: 'passport', title: 'Renew Emma’s passport', due: '4 Sep', p: 2, tags: 'admin' },
      { id: 'mot', title: 'Book the MOT', due: '', p: 0, tags: 'car' },
      { id: 'plants', title: 'Water the plants on the landing', due: '', p: 0, tags: '' },
      { id: 'fence', title: 'Ask the neighbours about the fence', due: '', p: 4, tags: '' },
      { id: 'bins', title: 'Take the bins out', due: '', p: 0, tags: '' },
      { id: 'water', title: 'Pay the water bill', due: '', p: 0, tags: '' }
    ];
  }

  toggle(id) {
    const next = Object.assign({}, this.state.done);
    next[id] = !next[id];
    this.setState({ done: next });
  }

  renderVals() {
    const all = this.data();
    const done = this.state.done;
    const show = this.state.show;
    const active = all.filter((t) => !done[t.id]);
    const completed = all.filter((t) => done[t.id]);

    return {
      active: active.map((t) => {
        const showDue = show.due && !!t.due;
        const showPri = show.pri && t.p > 0;
        const showTags = show.tags && !!t.tags;
        const hasMeta = showDue || showPri || showTags;
        const barColour = t.p === 1 ? '${DANGER}' : (t.p === 2 ? '#e0c48a' : 'transparent');
        return {
          title: t.title,
          due: t.due,
          pri: 'P' + t.p,
          tags: t.tags,
          showDue: showDue,
          showPri: showPri,
          showTags: showTags,
          hasMeta: hasMeta,
          rowStyle: 'display:flex;align-items:center;gap:11px;border-bottom:1px solid ${BORDER};cursor:pointer;min-height:' + (hasMeta ? '66' : '52') + 'px;',
          barStyle: show.pri
            ? 'flex:none;width:3px;border-radius:2px;align-self:stretch;margin:12px -5px 12px 0;background:' + barColour + ';'
            : 'display:none;',
          dueStyle: 'font-size:12px;font-weight:700;white-space:nowrap;color:' + (t.overdue ? '${DANGER}' : '${MUTED}') + ';',
          priStyle: 'font-size:11.5px;font-weight:800;white-space:nowrap;color:' + (t.p === 1 ? '${DANGER}' : (t.p === 2 ? '#b4791f' : '${MUTED}')) + ';',
          toggle: () => this.toggle(t.id)
        };
      }),
      completed: completed.map((t) => ({ title: t.title, toggle: () => this.toggle(t.id) })),
      completedLabel: 'Completed (' + completed.length + ')',
      completedOpen: this.state.open,
      chevronStyle: this.state.open ? 'transform: rotate(180deg);' : '',
      toggleCompleted: () => this.setState({ open: !this.state.open }),
      menuOpen: this.state.menu,
      toggleMenu: () => this.setState({ menu: !this.state.menu }),
      switches: [
        { key: 'due', name: 'Due dates' },
        { key: 'pri', name: 'Priority' },
        { key: 'tags', name: 'Labels' }
      ].map((s) => {
        const on = show[s.key];
        return {
          name: s.name,
          trackStyle: 'flex:none;width:44px;height:26px;border-radius:13px;padding:2px;display:flex;justify-content:' + (on ? 'flex-end' : 'flex-start') + ';background:' + (on ? '${TINT}' : '#d5d9d6') + ';',
          knobStyle: 'width:22px;height:22px;border-radius:11px;background:#ffffff;box-shadow:0 1px 3px rgba(31,36,33,0.25);',
          toggle: () => {
            const next = Object.assign({}, this.state.show);
            next[s.key] = !next[s.key];
            this.setState({ show: next });
          }
        };
      })
    };
  }
}`,
)

/* ── THE MIX — the two swipes ────────────────────────────────────────── */
/* Drawn rather than described: a still artboard cannot be swiped, and a canvas
   that only says "swipe right completes" is not showing you the design. */
const restRow = (title, meta = '') =>
  `      <div style="display: flex; align-items: center; gap: 11px; min-height: ${meta ? 66 : 52}px; border-bottom: 1px solid ${BORDER};">${checkbox(false)}<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px;"><span style="font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</span>${meta ? `<span style="font-size: 12px; font-weight: 700; color: ${MUTED};">${meta}</span>` : ''}</div></div>`

screens['MixGestures.dc.html'] = page(
  `${STATUS}
${navBar('Tasks', 'Household', ic(P.more, { size: 22, color: TINT }))}
${scroll(
  `    <div style="background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 16px; overflow: hidden;">

      <div style="display: flex; align-items: stretch; background: #2f7d54; min-height: 66px;">
        <div style="width: 96px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: #ffffff;">
          ${ic(P.check, { size: 21, color: '#ffffff', sw: 2.6 })}<span style="font-size: 12px; font-weight: 700;">Complete</span>
        </div>
        <div style="flex: 1; background: ${SURFACE}; display: flex; align-items: center; gap: 11px; padding: 0 14px; min-width: 0;">
          ${checkbox(false)}
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px;">
            <span style="font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Call the plumber about the radiator</span>
            <div style="display: flex; gap: 7px;"><span style="font-size: 12px; font-weight: 700; color: ${DANGER};">Tue</span><span style="font-size: 11.5px; font-weight: 800; color: ${DANGER};">P1</span></div>
          </div>
        </div>
      </div>

      <div style="padding: 0 14px;">
${restRow('Pick up the parcel from the DHL point', 'Today')}
      </div>

      <div style="display: flex; align-items: stretch; background: ${DANGER}; min-height: 66px;">
        <div style="flex: 1; background: ${SURFACE}; display: flex; align-items: center; gap: 11px; padding: 0 14px; min-width: 0;">
          ${checkbox(false)}
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px;">
            <span style="font-size: 15.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Renew Emma’s passport</span>
            <span style="font-size: 12px; font-weight: 700; color: ${MUTED};">4 Sep</span>
          </div>
        </div>
        <div style="width: 96px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; color: #ffffff;">
          ${ic(P.trash, { size: 20, color: '#ffffff', sw: 2 })}<span style="font-size: 12px; font-weight: 700;">Delete</span>
        </div>
      </div>

      <div style="padding: 0 14px;">
${restRow('Book the MOT', 'car')}
${restRow('Water the plants on the landing')}
        ${composer()}
      </div>
    </div>`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

/* ── THE MIX — press and hold ────────────────────────────────────────── */
screens['MixHold.dc.html'] = page(
  `${STATUS}
${navBar('Tasks', 'Household', ic(P.more, { size: 22, color: TINT }))}
  <div style="flex: 1; min-height: 0; overflow: hidden; padding: 12px 16px 0; filter: blur(3.5px); opacity: 0.5;">
    ${card(
      `${restRow('Call the plumber about the radiator', 'Tue · P1')}
${restRow('Pick up the parcel from the DHL point', 'Today')}
${restRow('Renew Emma’s passport', '4 Sep')}
${restRow('Book the MOT', 'car')}
${restRow('Water the plants on the landing')}
      ${composer()}`,
    )}
  </div>
${tabBar('all')}
${HOME_BAR(SURFACE)}

  <div style="position: absolute; left: 16px; right: 16px; top: 108px;">
    <div style="background: ${SURFACE}; border-radius: 14px; padding: 0 14px; display: flex; align-items: center; gap: 11px; min-height: 66px; box-shadow: 0 14px 32px rgba(31,36,33,0.24);">
      ${checkbox(false)}
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px;">
        <span style="font-size: 15.5px; font-weight: 600;">Call the plumber about the radiator</span>
        <div style="display: flex; gap: 7px;"><span style="font-size: 12px; font-weight: 700; color: ${DANGER};">Tue</span><span style="font-size: 11.5px; font-weight: 800; color: ${DANGER};">P1</span></div>
      </div>
    </div>
    <div style="margin-top: 10px; background: rgba(255,255,255,0.98); border-radius: 14px; overflow: hidden; box-shadow: 0 14px 32px rgba(31,36,33,0.24);">
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 46px; border-bottom: 1px solid ${BORDER};"><span style="font-size: 16px;">Complete</span>${ic(P.check, { size: 18, color: FG, sw: 2.2 })}</div>
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 46px; border-bottom: 1px solid ${BORDER};"><span style="font-size: 16px;">Rename</span>${ic(P.pencil, { size: 18, color: FG })}</div>
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 46px; border-bottom: 1px solid ${BORDER};"><span style="font-size: 16px;">Due date</span>${ic(P.calendar, { size: 18, color: FG })}</div>
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 46px; border-bottom: 1px solid ${BORDER};"><span style="font-size: 16px;">Priority</span>${ic(P.flag, { size: 18, color: FG })}</div>
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 46px; border-bottom: 1px solid ${BORDER};"><span style="font-size: 16px;">Move to list…</span>${ic(P.listChecks, { size: 18, color: FG })}</div>
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 46px; border-bottom: 1px solid ${BORDER};"><span style="font-size: 16px;">Reorder</span>${ic(P.grip, { size: 18, color: FG })}</div>
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 14px; min-height: 46px;"><span style="font-size: 16px; color: ${DANGER};">Delete</span>${ic(P.trash, { size: 18, color: DANGER })}</div>
    </div>
  </div>`,
)

/* ── THE MIX — a linked list, opened ─────────────────────────────────── */
/* Where "it behaves like a local list" stops being true. Both adapters are
   capabilities.write: false today (convex/lib/taskProviders/), so gather may
   only read this one — ADR-0021 says it must say so and hide the composer
   rather than emulate the write locally. Pull-to-refresh exists here and
   nowhere else, because this is the only list Convex does not keep live. */
screens['MixLinked.dc.html'] = page(
  `${STATUS}
${navBar('Tasks', 'Work', ic(P.more, { size: 22, color: TINT }))}
${scroll(
  `    <div style="display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: -4px;">
      ${ic(P.refresh, { size: 14, color: MUTED })}<span style="font-size: 12.5px; color: ${MUTED};">Updated 4 minutes ago · pull to refresh</span>
    </div>

    ${card(
      `${restRow('Send the Q3 invoice', 'Fri · P1')}
${restRow('Review the onboarding deck', 'Mon')}
${restRow('Book the team offsite', 'admin')}
${restRow('Reply to the procurement email')}
${restRow('Update the runbook')}
      ${row(
        `<span style="flex: 1; font-size: 13px; line-height: 19px; color: ${MUTED}; padding: 11px 0;">Kept in Todoist, so gather can only read it. Tick these off in Todoist and they will disappear from here.</span>`,
        { min: 44, last: true },
      )}`,
    )}

    <div style="display: flex; gap: 9px; padding: 11px 13px; background: ${TINT_BG}; border-radius: 12px;">
      ${ic(P.listChecks, { size: 17, color: TINT, style: 'margin-top: 1px;' })}<span style="flex: 1; font-size: 13px; line-height: 19px; color: ${TINT};">Everything else is the same: it sits in the same list index, opens the same way, and its rows carry the same properties.</span>
    </div>`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

export default screens
