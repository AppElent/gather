/** Notes — THE MIX, and three directions that disagree about what a note is. */
import {
  BORDER, DANGER, FG, HOME_BAR, KITCHEN, KITCHEN_BG, MONEY, MONEY_BG, MUTED, P,
  STATIC, STATUS, SURFACE, TASTING, TASTING_BG, TILE, TINT, TINT_BG, badge,
  bigTitle, card, checkbox, ic, label, navBar, page, row, scroll, tabBar,
  topActions,
} from './_kit.mjs'

const screens = {}

const noteRow = (title, preview, when, last = false) =>
  row(
    `<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;"><span style="font-size: 16px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</span><span style="font-size: 13px; color: ${MUTED}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${preview}</span></div><span style="font-size: 12.5px; color: ${MUTED}; white-space: nowrap;">${when}</span>`,
    { min: 62, last },
  )

const searchField = () =>
  `    <div style="display: flex; align-items: center; gap: 8px; background: ${TILE}; border-radius: 11px; padding: 0 11px; min-height: 38px;">${ic(P.search, { size: 17, color: MUTED })}<span style="flex: 1; font-size: 15.5px; color: ${MUTED};">Search notes</span></div>`

/* ── THE MIX — Notes index ───────────────────────────────────────────── */
screens['MixNotes.dc.html'] = page(
  `${STATUS}
${topActions(ic(P.plus, { size: 24, color: TINT, sw: 2.2 }))}
${bigTitle('Notes', 'Huize Jansen')}
${scroll(
  `${searchField()}

    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('PINNED')}
      ${card(noteRow('Wifi and door codes', 'Guest wifi: HuizeJansen-Gast · code 4471', 'Jun', true))}
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('RECENT')}
      ${card(
        noteRow('Loft conversion — what the builder said', 'Steel goes in first, so the scaffolding needs to…', 'Yest') +
          noteRow("Mum's appeltaart", '150 g roomboter, 200 g bruine basterdsuiker, 1 ei…', 'Tue') +
          noteRow('Things to sort before the holiday', 'Stop the post · water the plants · Emma’s ehic…', '12 Aug') +
          noteRow('Radiator — plumber notes', 'Bleed valve on the landing one is seized; he wants…', '9 Aug', true),
      )}
    </div>

    <div style="font-size: 12.5px; line-height: 18px; color: ${MUTED}; padding: 0 2px;">Notes belong to the household, like every other Module.</div>`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

/* ── THE MIX — One note ──────────────────────────────────────────────── */
screens['MixNote.dc.html'] = page(
  `${STATUS}
${navBar('Notes', '', `${ic(P.pin, { size: 21, color: TINT })}${ic(P.more, { size: 22, color: TINT })}`)}
  <div style="flex: 1; min-height: 0; overflow: hidden; padding: 4px 18px 0; display: flex; flex-direction: column; gap: 12px;">
    <div style="font-size: 26px; font-weight: 800; line-height: 33px; letter-spacing: -0.7px; text-wrap: pretty;">Loft conversion — what the builder said</div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 12.5px; color: ${MUTED};">Edited yesterday by Anne</span>
    </div>
    <div style="font-size: 16.5px; line-height: 26px; color: ${FG}; text-wrap: pretty; display: flex; flex-direction: column; gap: 14px;">
      <div>Steel goes in first, so the scaffolding needs to stay up an extra week. He was clear that nothing else can start until building control has seen it.</div>
      <div style="font-weight: 700; font-size: 15px; letter-spacing: -0.2px;">What he needs from us</div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; gap: 10px;"><span style="color: ${MUTED};">•</span><span style="flex: 1;">A decision on the dormer width by the end of the month</span></div>
        <div style="display: flex; gap: 10px;"><span style="color: ${MUTED};">•</span><span style="flex: 1;">The neighbours' written OK for the party wall</span></div>
        <div style="display: flex; gap: 10px;"><span style="color: ${MUTED};">•</span><span style="flex: 1;">Somewhere to put the skip that isn't the drive</span></div>
      </div>
      <div>Quote lands Friday. He said the number moves if we change the window spec after the steel is ordered.</div>
    </div>
  </div>
  <div style="flex: none; display: flex; align-items: center; gap: 26px; padding: 0 20px; height: 46px; border-top: 1px solid ${BORDER}; background: ${SURFACE};">
    ${ic(P.bold, { size: 19, color: FG, sw: 2 })}
    ${ic(P.bullet, { size: 19, color: FG })}
    ${ic(P.checkSquare, { size: 19, color: FG })}
    ${ic(P.listChecks, { size: 19, color: FG })}
    <div style="flex: 1;"></div>
    <span style="font-size: 15px; font-weight: 700; color: ${TINT};">Done</span>
  </div>
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

/* ── A — Notes are documents ─────────────────────────────────────────── */
screens['NotesA.dc.html'] = page(
  `${STATUS}
${topActions(ic(P.plus, { size: 24, color: TINT, sw: 2.2 }))}
${bigTitle('Notes', 'Huize Jansen')}
${scroll(
  `${searchField()}
    ${card(
      noteRow('Loft conversion — what the builder said', 'Steel goes in first, so the scaffolding needs to…', 'Yest') +
        noteRow('Wifi and door codes', 'Guest wifi: HuizeJansen-Gast · code 4471', 'Tue') +
        noteRow("Mum's appeltaart", '150 g roomboter, 200 g bruine basterdsuiker…', '19 Aug') +
        noteRow('Things to sort before the holiday', 'Stop the post · water the plants · ehic cards', '12 Aug') +
        noteRow('Radiator — plumber notes', 'Bleed valve on the landing one is seized…', '9 Aug') +
        noteRow('Emma — what the health visitor said', 'Weaning: one new thing every three days, and…', '2 Aug', true),
    )}`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

screens['NoteA.dc.html'] = page(
  `${STATUS}
${navBar('Notes', '', ic(P.more, { size: 22, color: TINT }))}
  <div style="flex: 1; min-height: 0; overflow: hidden; padding: 4px 18px 0; display: flex; flex-direction: column; gap: 11px;">
    <div style="font-size: 26px; font-weight: 800; line-height: 33px; letter-spacing: -0.7px;">Wifi and door codes</div>
    <div style="font-size: 12.5px; color: ${MUTED};">Edited 3 Jun by Eric</div>
    <div style="font-size: 16.5px; line-height: 26px; display: flex; flex-direction: column; gap: 14px;">
      <div style="font-weight: 700; font-size: 15px;">Wifi</div>
      <div>Guest network is <span style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 15px; background: ${TILE}; border-radius: 5px; padding: 1px 5px;">HuizeJansen-Gast</span> — the password is on the back of the router and it is fine to give out.</div>
      <div style="font-weight: 700; font-size: 15px;">Front door</div>
      <div>Keypad code <span style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 15px; background: ${TILE}; border-radius: 5px; padding: 1px 5px;">4471</span>, then the hash key. It beeps twice if you were too slow.</div>
      <div style="font-weight: 700; font-size: 15px;">Bins</div>
      <div>Grey every Tuesday, green the Wednesday after a bank holiday.</div>
    </div>
  </div>
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

/* ── B — Notes are cards you capture ─────────────────────────────────── */
const keepCard = (inner, bg, brd) =>
  `      <div style="background: ${bg}; border: 1px solid ${brd}; border-radius: 14px; padding: 12px 13px; display: flex; flex-direction: column; gap: 8px;">${inner}</div>`

const keepTitle = (t) =>
  `<span style="font-size: 14.5px; font-weight: 700; letter-spacing: -0.2px;">${t}</span>`
const keepBody = (t) =>
  `<span style="font-size: 13.5px; line-height: 20px; color: ${FG}; text-wrap: pretty;">${t}</span>`
const keepItem = (t, done = false) =>
  `<div style="display: flex; align-items: flex-start; gap: 8px;"><div style="margin-top: 1px; flex: none; width: 15px; height: 15px; border-radius: 4px; border: 1.5px solid ${done ? TINT : '#c3c8c4'}; background: ${done ? TINT : 'transparent'}; display: flex; align-items: center; justify-content: center;">${done ? ic(P.check, { size: 10, color: SURFACE, sw: 3.4 }) : ''}</div><span style="flex: 1; font-size: 13px; line-height: 19px; ${done ? `color: ${MUTED}; text-decoration: line-through;` : ''}">${t}</span></div>`

screens['NotesB.dc.html'] = page(
  `${STATUS}
${topActions(`${ic(P.search, { size: 22, color: TINT })}${ic(P.more, { size: 22, color: TINT })}`)}
${bigTitle('Notes', 'Huize Jansen')}
  <div style="flex: 1; min-height: 0; overflow: hidden; padding: 4px 16px 0; display: flex; flex-direction: column; gap: 10px;">
    <div style="font-size: 11.5px; font-weight: 700; letter-spacing: 0.8px; color: ${MUTED}; padding-left: 2px;">PINNED</div>
    <div style="display: flex; gap: 10px; align-items: flex-start;">
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px;">
${keepCard(keepTitle('Wifi and door codes') + keepBody('Guest: HuizeJansen-Gast<br>Door: 4471 then #'), TINT_BG, '#e6dcc7')}
${keepCard(keepTitle('Holiday') + keepItem('Stop the post', true) + keepItem('Water the plants') + keepItem('EHIC cards') + keepItem('Cancel the veg box'), MONEY_BG, '#cfe0d4')}
${keepCard(keepBody('The man at the garden centre said to cut the hydrangea back in <b>March</b>, not now.'), SURFACE, BORDER)}
      </div>
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px;">
${keepCard(keepTitle("Mum's appeltaart") + keepBody('150 g roomboter<br>200 g bruine basterdsuiker<br>1 ei<br>300 g zelfrijzend bakmeel'), TASTING_BG, '#e2d0da')}
${keepCard(keepTitle('Loft') + keepBody('Steel first. Scaffolding stays up an extra week. Quote Friday.'), KITCHEN_BG, '#c9e3e0')}
${keepCard(keepBody('Plumber: 06 2244 8810'), SURFACE, BORDER)}
      </div>
    </div>
  </div>
  <div style="flex: none; padding: 10px 16px 12px;">
    <div style="display: flex; align-items: center; gap: 14px; background: ${SURFACE}; border: 1px solid ${BORDER}; border-radius: 999px; padding: 0 16px; min-height: 48px; box-shadow: 0 3px 12px rgba(31,36,33,0.07);">
      <span style="flex: 1; font-size: 15.5px; color: ${MUTED};">Take a note…</span>
      ${ic(P.checkSquare, { size: 20, color: TINT })}
      ${ic(P.image, { size: 20, color: TINT })}
    </div>
  </div>
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

screens['NoteB.dc.html'] = page(
  `${STATUS}
  <div style="flex: none; display: flex; align-items: center; height: 52px; padding: 0 16px 0 8px; gap: 8px;">
    <div style="flex: 1; display: flex; align-items: center; gap: 1px; color: ${TINT}; cursor: pointer;">${ic(P.chevronL, { size: 22, color: TINT, sw: 2 })}<span style="font-size: 17px;">Notes</span></div>
    <div style="display: flex; align-items: center; gap: 17px;">${ic(P.pin, { size: 21, color: TINT })}${ic(P.more, { size: 22, color: TINT })}</div>
  </div>
  <div style="flex: 1; min-height: 0; overflow: hidden; padding: 4px 18px 0; display: flex; flex-direction: column; gap: 14px;">
    <div style="font-size: 22px; font-weight: 700; letter-spacing: -0.5px; color: ${MUTED};">Holiday</div>
    <div style="display: flex; flex-direction: column; gap: 3px;">
      <sc-for list="{{ items }}" as="i" hint-placeholder-count="5">
        <div onClick="{{ i.toggle }}" style="display: flex; align-items: flex-start; gap: 11px; min-height: 40px; cursor: pointer;">
          <div style="{{ i.boxStyle }}"><sc-if value="{{ i.done }}" hint-placeholder-val="{{ false }}">${ic(P.check, { size: 13, color: SURFACE, sw: 3.2 })}</sc-if></div>
          <span style="{{ i.textStyle }}">{{ i.text }}</span>
        </div>
      </sc-for>
      <div style="display: flex; align-items: center; gap: 11px; min-height: 40px;">
        ${ic(P.plus, { size: 17, color: MUTED, sw: 2.2 })}<span style="font-size: 15.5px; color: ${MUTED};">List item</span>
      </div>
    </div>
    <div style="font-size: 12.5px; color: ${MUTED};">Edited 2 hours ago by Anne</div>
  </div>
  <div style="flex: none; display: flex; align-items: center; gap: 12px; padding: 0 18px; height: 52px; border-top: 1px solid ${BORDER}; background: ${SURFACE};">
    <sc-for list="{{ colours }}" as="c" hint-placeholder-count="5">
      <div onClick="{{ c.pick }}" style="{{ c.style }}"></div>
    </sc-for>
    <div style="flex: 1;"></div>
    ${ic(P.image, { size: 20, color: FG })}
    ${ic(P.trash, { size: 20, color: DANGER })}
  </div>
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
  `class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { done: { post: true }, colour: 'money' };
  }

  renderVals() {
    const items = [
      { id: 'post', text: 'Stop the post' },
      { id: 'plants', text: 'Water the plants' },
      { id: 'ehic', text: 'EHIC cards for all three of us' },
      { id: 'veg', text: 'Cancel the veg box' },
      { id: 'keys', text: 'Keys to number 14' }
    ];
    const swatches = [
      { id: 'plain', bg: '${SURFACE}' },
      { id: 'home', bg: '${TINT_BG}' },
      { id: 'money', bg: '${MONEY_BG}' },
      { id: 'kitchen', bg: '${KITCHEN_BG}' },
      { id: 'tasting', bg: '${TASTING_BG}' }
    ];
    return {
      items: items.map((item) => {
        const on = !!this.state.done[item.id];
        return {
          text: item.text,
          done: on,
          boxStyle: 'margin-top:2px;flex:none;width:19px;height:19px;border-radius:5px;display:flex;align-items:center;justify-content:center;border:1.6px solid ' + (on ? '${TINT}' : '#c3c8c4') + ';background:' + (on ? '${TINT}' : 'transparent') + ';',
          textStyle: 'flex:1;font-size:16px;line-height:23px;' + (on ? 'color:${MUTED};text-decoration:line-through;' : 'color:${FG};'),
          toggle: () => {
            const next = Object.assign({}, this.state.done);
            next[item.id] = !next[item.id];
            this.setState({ done: next });
          }
        };
      }),
      colours: swatches.map((s) => ({
        style: 'width:26px;height:26px;border-radius:13px;cursor:pointer;background:' + s.bg + ';border:' + (this.state.colour === s.id ? '2.5px solid ${FG}' : '1px solid ${BORDER}') + ';',
        pick: () => this.setState({ colour: s.id })
      }))
    };
  }
}`,
)

/* ── C — Notes are attached to things ────────────────────────────────── */
const subjectRow = (icon, tint, tintBg, subject, kind, preview, when, last = false) =>
  row(
    `<div style="width: 34px; height: 34px; border-radius: 10px; background: ${tintBg}; display: flex; align-items: center; justify-content: center; flex: none;">${ic(icon, { size: 18, color: tint })}</div><div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;"><div style="display: flex; align-items: baseline; gap: 6px;"><span style="font-size: 15.5px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${subject}</span><span style="font-size: 11.5px; color: ${MUTED}; white-space: nowrap;">${kind}</span></div><span style="font-size: 13px; color: ${MUTED}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${preview}</span></div><span style="font-size: 12px; color: ${MUTED}; white-space: nowrap;">${when}</span>`,
    { min: 62, last },
  )

screens['NotesC.dc.html'] = page(
  `${STATUS}
${topActions(ic(P.plus, { size: 24, color: TINT, sw: 2.2 }))}
${bigTitle('Notes', 'Huize Jansen')}
${scroll(
  `    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('ON THINGS IN THIS HOUSEHOLD')}
      ${card(
        subjectRow(P.listChecks, TINT, TINT_BG, 'Household', 'list', 'Eric: plumber wants the landing radiator off first', '2h') +
          subjectRow(P.baby, TINT, TINT_BG, 'Emma', 'child', 'Anne: health visitor says one new food every three…', 'Yest') +
          subjectRow(P.chef, KITCHEN, KITCHEN_BG, 'Pannenkoeken', 'recipe', 'Eric: half the sugar, and it needs a hotter pan', 'Tue') +
          subjectRow(P.listChecks, TINT, TINT_BG, 'Shopping', 'list', 'Anne: the Turkish shop has the big yoghurt again', '18 Aug', true),
      )}
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px;">
      ${label('ABOUT THE HOUSEHOLD ITSELF')}
      ${card(
        subjectRow(P.notebookPen, MUTED, TILE, 'Wifi and door codes', 'general', 'Eric: guest wifi is HuizeJansen-Gast, door is 4471', 'Jun') +
          subjectRow(P.notebookPen, MUTED, TILE, 'Loft conversion', 'general', 'Anne: steel first, scaffolding stays an extra week', 'Yest', true),
      )}
    </div>

    <div style="font-size: 12.5px; line-height: 18px; color: ${MUTED}; padding: 0 2px;">Every note hangs off something. The bottom group is what hangs off nothing.</div>`,
)}
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

const entry = (who, initial, when, text, last = false) =>
  `      <div style="display: flex; gap: 11px;${last ? '' : ` padding-bottom: 16px; border-bottom: 1px solid ${BORDER};`}">
        <div style="width: 30px; height: 30px; border-radius: 15px; background: ${TINT_BG}; color: ${TINT}; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex: none;">${initial}</div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; align-items: baseline; gap: 7px;"><span style="font-size: 14px; font-weight: 700;">${who}</span><span style="font-size: 12px; color: ${MUTED};">${when}</span></div>
          <div style="font-size: 15.5px; line-height: 23px; text-wrap: pretty;">${text}</div>
        </div>
      </div>`

screens['NoteC.dc.html'] = page(
  `${STATUS}
${navBar('Notes', '', ic(P.more, { size: 22, color: TINT }))}
  <div style="flex: none; padding: 0 18px 12px; display: flex; flex-direction: column; gap: 8px;">
    <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.6px;">Notes on Household</div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: ${TINT}; background: ${TINT_BG}; border-radius: 999px; padding: 5px 11px;">${ic(P.listChecks, { size: 14, color: TINT })}Task list</span>
      <span style="font-size: 12.5px; color: ${MUTED};">4 notes · everyone in the household</span>
    </div>
  </div>
  <div style="flex: 1; min-height: 0; overflow: hidden; padding: 0 18px; display: flex; flex-direction: column; gap: 16px;">
${entry('Eric', 'E', '2 hours ago', 'Plumber wants the landing radiator off the wall first, so don’t start the painting until that’s done.')}
${entry('Anne', 'A', 'Yesterday', 'He also said the valve is seized, and quoted €180 for the pair. I said yes.')}
${entry('Eric', 'E', 'Tuesday', 'Reminder that the stopcock is behind the boiler cupboard, not under the sink.')}
${entry('Anne', 'A', '12 Aug', 'Bin day moves to Wednesday for the bank holiday week.', true)}
  </div>
  <div style="flex: none; padding: 10px 16px 12px; border-top: 1px solid ${BORDER}; background: ${SURFACE};">
    <div style="display: flex; align-items: center; gap: 11px; background: ${TILE}; border-radius: 999px; padding: 0 16px; min-height: 44px;">
      <span style="flex: 1; font-size: 15.5px; color: ${MUTED};">Add to this note…</span>
      ${ic(P.plus, { size: 19, color: TINT, sw: 2.2 })}
    </div>
  </div>
${tabBar('all')}
${HOME_BAR(SURFACE)}`,
)

export default screens
