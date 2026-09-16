// THROWAWAY. Three Tasks hierarchies on one route. Fixture writes only.
// Browser layout evidence, never a claim about native iOS keyboard or gestures.
const $ = (s) => document.querySelector(s)
const copy = (v) => structuredClone(v)
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
let locale = 'en'
const words = {
  tasks: ['Tasks', 'Taken'], today: ['Today', 'Vandaag'], mine: ['Mine', 'Van mij'], everyone: ['Everyone', 'Iedereen'], lists: ['Lists', 'Lijsten'], responsibilities: ['Responsibilities', 'Verantwoordelijkheden'], overdue: ['Overdue', 'Over tijd'], upcoming: ['Upcoming & undated', 'Binnenkort en zonder datum'], unassigned: ['Unassigned', 'Niet toegewezen'], you: ['You', 'Jij'], add: ['Add task', 'Taak toevoegen'], save: ['Save', 'Opslaan'], close: ['Close', 'Sluiten'], title: ['Task name', 'Taaknaam'], details: ['More details', 'Meer details'], date: ['Due date', 'Datum'], none: ['None', 'Geen'], assignee: ['Responsible Member', 'Verantwoordelijk lid'], repeat: ['Repeat', 'Herhalen'], fixed: ['Every Tuesday · fixed schedule', 'Elke dinsdag · vast schema'], interval: ['7 days after completion', '7 dagen na voltooiing'], monthly: ['Monthly on the 31st', 'Maandelijks op de 31e'], reminder: ['Remind me', 'Herinner mij'], morning: ['On the due date at 09:00', 'Op de datum om 09:00'], subtasks: ['Subtasks', 'Subtaken'], child: ['Add subtask', 'Subtaak toevoegen'], notes: ['Notes', 'Notities'], draft: ['Resume draft', 'Concept hervatten'], saved: ['Saved', 'Opgeslagen'], draftkept: ['Draft kept. Nothing saved yet.', 'Concept bewaard. Nog niets opgeslagen.'], completed: ['Completed', 'Voltooid'], readonly: ['Read-only · Notion', 'Alleen-lezen · Notion'], outage: ['Provider unavailable. Last data is readable; changes are disabled.', 'Dienst niet bereikbaar. Laatste gegevens leesbaar; wijzigen uitgeschakeld.'], refresh: ['Refresh', 'Vernieuwen'], history: ['Completion history', 'Voltooiingsgeschiedenis'], empty: ['All clear here.', 'Hier is alles gedaan.'], list: ['List', 'Lijst'], priority: ['Priority', 'Prioriteit'], normal: ['Normal', 'Normaal'], high: ['High', 'Hoog'], labels: ['Labels', 'Labels'], remindersoff: ['Your task reminders are off.', 'Je taakherinneringen staan uit.'], muted: ['This Group is muted for you.', 'Deze groep is voor jou gedempt.'], permission: ['Notifications are not allowed on this device.', 'Meldingen zijn niet toegestaan op dit apparaat.'], remindready: ['Reminder selected for you. No notification is sent in this prototype.', 'Herinnering voor jou ingesteld. Dit prototype verstuurt geen melding.'], noreminder: ['A date alone does not send a reminder.', 'Een datum alleen verstuurt geen herinnering.'], parentquestion: ['Complete the unfinished subtasks too?', 'De onvoltooide subtaken ook voltooien?'], parentonly: ['Parent only', 'Alleen hoofdtaak'], all: ['Complete all', 'Alles voltooien'], cancel: ['Cancel', 'Annuleren'], nochildrepeat: ['Subtasks repeat with their parent.', 'Subtaken herhalen met de hoofdtaak.'], viewall: ['View all lists', 'Alle lijsten bekijken'], home: ['Home', 'Thuis'], pinned: ['Pinned', 'Vastgezet'], allmodules: ['All', 'Alles'], settings: ['Settings', 'Instellingen'], new: ['New task', 'Nieuwe taak'], edit: ['Edit task', 'Taak bewerken'], incomplete: ['unfinished', 'onvoltooid'], ownonly: ['Assigned to you', 'Aan jou toegewezen'], withunassigned: ['Assigned to you + unassigned', 'Aan jou toegewezen + niet toegewezen'], more: ['Open details', 'Details openen'], compact: ['Compact rows', 'Compacte rijen'], duevisible: ['Show dates', 'Datums tonen'], priorityvisible: ['Show priority', 'Prioriteit tonen'], labelsvisible: ['Show labels', 'Labels tonen'], next: ['Next', 'Volgende'], bulk: ['Reschedule', 'Herplannen'], tomorrow: ['Tomorrow', 'Morgen'], bulkquestion: ['Move these overdue dates to tomorrow?', 'Deze verlopen datums naar morgen verplaatsen?'], bulkdetail: ['Only non-repeating, writable tasks in this view. Repeating schedules are left unchanged.', 'Alleen niet-herhalende, bewerkbare taken in deze weergave. Herhaalschema’s blijven gelijk.'], source: ['Source', 'Bron'], readreason: ['Notion viewing only. Edit in Notion.', 'Notion is alleen-lezen. Bewerk in Notion.'], providerlimited: ['Assignment, recurrence and subtask mapping for Todoist are still undecided. These fields are disabled in this fixture.', 'Toewijzing, herhaling en subtaken voor Todoist zijn nog niet uitgewerkt. Deze velden staan uit in dit voorbeeld.'], duefirst: ['Choose a due date first.', 'Kies eerst een datum.'], dismissdraft: ['Dismiss to keep a draft; Save applies every field together.', 'Sluiten bewaart een concept; Opslaan past alle velden samen toe.'], alreadydraft: ['Finish or dismiss the open draft before starting another.', 'Rond het open concept af of sluit het voordat je een nieuw concept begint.'], pending: ['Awaiting provider acknowledgement…', 'Wachten op bevestiging van de dienst…'], acknowledged: ['Saved · provider acknowledgement simulated', 'Opgeslagen · bevestiging dienst gesimuleerd'], early: ['Early recurring completion is still a design question. Move the prototype date forward to exercise due completion.', 'Vroege voltooiing van herhalende taken is nog een ontwerpvraag. Zet de prototypedatum vooruit om voltooiing te verkennen.'], historyempty: ['No completions yet.', 'Nog geen voltooiingen.'], nameRequired: ['Enter a task name.', 'Vul een taaknaam in.']
}
const t = (key) => words[key]?.[locale === 'nl' ? 1 : 0] ?? key
const lists = [
  { id: 'home', title: ['Household', 'Huishouden'], provider: 'local' },
  { id: 'groceries', title: ['Groceries', 'Boodschappen'], provider: 'local', simple: true },
  { id: 'baby', title: ['Baby checklist', 'Babychecklist'], provider: 'local', simple: true },
  { id: 'todoist', title: ['Weekend plans', 'Weekendplannen'], provider: 'Todoist' },
  { id: 'notion', title: ['Moving house', 'Verhuizen'], provider: 'Notion' },
]
const listName = (id) => lists.find(l => l.id === id)?.title[locale === 'nl' ? 1 : 0] ?? id
const seed = [
  { id: 'plumber', title: 'Call the plumber', list: 'home', due: '2026-09-14', who: 'Eric', priority: 'high', labels: 'house' },
  { id: 'bins', title: 'Put the bins out', list: 'home', due: '2026-09-15', who: 'Eric', repeat: 'fixed' },
  { id: 'bathroom', title: 'Clean the bathroom', list: 'home', due: '2026-09-13', who: 'Anne', repeat: 'interval', children: [{ id: 'sink', title: 'Clean the sink', who: 'Eric', due: '2026-09-13', done: true }, { id: 'towels', title: 'Change the towels', who: 'Anne', due: '2026-09-14', done: false }] },
  { id: 'parcel', title: 'Collect the parcel', list: 'home', due: '2026-09-16', who: 'Anne' },
  { id: 'plants', title: 'Water the plants', list: 'home', due: '2026-09-16', who: '' },
  { id: 'insurance', title: 'Compare home insurance', list: 'home', due: '', who: 'Eric' },
  { id: 'monthly', title: 'Check the meter reading', list: 'home', due: '2026-01-31', who: 'Eric', repeat: 'monthly' },
  { id: 'milk', title: 'Oat milk', list: 'groceries', due: '', who: '' },
  { id: 'bread', title: 'Sourdough bread', list: 'groceries', due: '', who: '' },
  { id: 'bag', title: 'Pack the changing bag', list: 'baby', due: '', who: '' },
  { id: 'tickets', title: 'Book museum tickets', list: 'todoist', due: '2026-09-16', who: '' },
  { id: 'address', title: 'Update our address', list: 'notion', due: '2026-09-14', who: 'Eric' },
].map(task => ({ done: false, repeat: '', reminder: '', priority: '', labels: '', notes: '', children: [], ...task }))
let tasks = copy(seed), history = [], drafts = {}, currentDraft = null, modal = null, pending = false
let today = '2026-09-16', variant = new URLSearchParams(location.search).get('variant') || 'A', page = 'landing', filter = 'everyone', includeUnassigned = false
if (!['A', 'B', 'C'].includes(variant)) variant = 'A'
let providerDown = false, reminders = true, assignmentNotifications = true, muted = false, permission = true, notice = '', display = { due: true, priority: true, labels: true }, compact = true
const variants = { A: ['Today first', 'Vandaag eerst'], B: ['Lists first', 'Lijsten eerst'], C: ['Responsibility first', 'Verantwoordelijkheid eerst'] }
const name = (who) => who === 'Eric' ? `Eric · ${t('you')}` : who || t('unassigned')
const writable = (id) => id !== 'notion' && !(id === 'todoist' && providerDown)
const active = () => tasks.filter(task => !task.done)
const isMine = (task) => task.who === 'Eric' || (includeUnassigned && !task.who)
const dateText = (date) => date === today ? t('today') : new Date(`${date}T12:00:00`).toLocaleDateString(locale === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'short' })
const button = (label, action, cls = '', disabled = false) => `<button type="button" class="${cls}" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`
const avatar = (who) => who ? `<span class="avatar ${who === 'Anne' ? 'anne' : ''}" title="${esc(name(who))}">${who === 'Eric' ? 'EJ' : 'AN'}</span>` : ''
const options = (items, value) => items.map(([key, label]) => `<option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(label)}</option>`).join('')
const select = (key, items, value, disabled = false) => `<select data-field="${key}" aria-label="${esc(t(key))}" ${disabled ? 'disabled' : ''}>${options(items, value)}</select>`
function rows(items, showSource = true) {
  return items.length ? items.map(task => `<div class="row ${task.done ? 'done' : ''}">
    ${button(`<span class="circle">${task.done ? '✓' : ''}</span>`, `complete:${task.id}`, 'tick', !writable(task.list) || pending).replace('type="button"', `type="button" aria-label="${esc(t('completed') + ': ' + task.title)}"`)}
    <button class="rowbody" data-action="edit:${task.id}"><span class="titleline"><span class="title">${esc(task.title)}</span>${avatar(task.who)}</span>
    <span class="meta">${task.children.length ? `<span>⑂ ${task.children.filter(c => c.done).length}/${task.children.length}</span>` : ''}${task.due && display.due ? `<span class="${task.due < today && !task.done ? 'overdue' : ''}">▣ ${dateText(task.due)}${task.repeat ? ' ↻' : ''}</span>` : ''}${task.priority === 'high' && display.priority ? '<span>⚑</span>' : ''}${task.labels && display.labels ? `<span>${esc(task.labels)}</span>` : ''}${!compact && task.reminder ? '<span>♧</span>' : ''}${showSource ? `<span class="source">${esc(listName(task.list))}${task.list === 'notion' ? ' · ◇' : task.list === 'todoist' ? ' · ↗' : ''}</span>` : ''}</span></button></div>`).join('') : `<p class="empty">${t('empty')}</p>`
}
function listLinks() {
  return lists.map(l => `<button class="listlink" data-action="page:list-${l.id}"><span class="symbol">☷</span><span class="desc">${listName(l.id)}${l.provider !== 'local' ? `<small>${l.provider}${l.id === 'notion' ? ' · ' + t('readonly') : providerDown ? ' · ' + t('outage') : ''}</small>` : ''}</span><small>${active().filter(task => task.list === l.id).length}</small><span>›</span></button>`).join('')
}
function dated(items) {
  return `<div class="sectiontitle"><h2>${t('overdue')}</h2>${button(t('bulk'), 'reschedule')}</div>${rows(items.filter(x => x.due && x.due < today))}<h2>${t('today')}</h2>${rows(items.filter(x => x.due === today))}`
}
function landingA() {
  const items = active().filter(task => filter !== 'mine' || isMine(task))
  return `<h1>${t('today')}</h1><div class="segmented">${button(t('everyone'), 'filter:everyone', filter === 'everyone' ? 'selected' : '')}${button(t('mine'), 'filter:mine', filter === 'mine' ? 'selected' : '')}</div>${filter === 'mine' ? `<small>${t(includeUnassigned ? 'withunassigned' : 'ownonly')}</small>` : ''}${dated(items)}<div class="addwrap">${button('+ ' + t('add'), 'new', 'add')}</div><h2>${t('lists')}</h2>${listLinks()}`
}
function landingB() {
  return `<h1>${t('tasks')}</h1><div class="destinations">${button(`▣ ${t('today')}<strong>${active().filter(x => x.due && x.due <= today).length}</strong>`, 'page:today', 'destination')}${button(`♙ ${t('mine')}<strong>${active().filter(isMine).length}</strong>`, 'page:mine', 'destination')}</div><h2>${t('lists')}</h2>${listLinks()}<div class="addwrap">${button('+ ' + t('add'), 'new', 'add')}</div>`
}
function landingC() {
  return `<h1>${t('responsibilities')}</h1><small>${t('overdue')} · ${t('today')} · ${t('upcoming')}</small>${['Eric', 'Anne', ''].map(who => `<div class="personhead">${avatar(who)}<h2>${name(who)}</h2>${button('+', `new:${who}`)}</div>${rows(active().filter(x => x.who === who))}`).join('')}<h2>${t('lists')}</h2>${listLinks()}`
}
function render() {
  document.documentElement.lang = locale
  $('#lab').innerHTML = `<span class="eyebrow">Throwaway · design exploration</span><h1>What should lead?</h1><p>Same Group, same tasks, three ways in. Inspired by your Todoist reference: quiet rows and a compact composer.</p><p><b>A</b> Do today’s work.<br><b>B</b> Open a familiar list.<br><b>C</b> See who is responsible.</p><label>Language <select id="locale">${options([['en','English'],['nl','Nederlands']], locale)}</select></label><label><input id="dark" type="checkbox" ${document.body.classList.contains('dark') ? 'checked' : ''}> Dark</label><label><input id="large" type="checkbox" ${document.body.classList.contains('large') ? 'checked' : ''}> Large text</label><hr><label>Scenario date <input id="today" type="date" value="${today}"></label>${button('31 Jan → February', 'february')}${button('Reset fixtures', 'reset')}<p>Browser prototype only. No provider calls, storage, notifications or production changes.</p>`
  const currentList = page.startsWith('list-') ? page.slice(5) : null
  let content = ''
  if (currentList) {
    content = `<h1>${listName(currentList)}</h1>${!writable(currentList) ? `<p class="notice">${t(currentList === 'notion' ? 'readreason' : 'outage')}</p>` : ''}${['todoist','notion'].includes(currentList) ? button(t('refresh'), 'refresh') : ''}${rows(active().filter(x => x.list === currentList), false)}<div class="addwrap">${button('+ ' + t('add'), 'new', 'add', !writable(currentList))}</div><details><summary>${t('completed')}</summary>${rows(tasks.filter(x => x.list === currentList && x.done), false)}</details><details><summary>${t('history')}</summary>${historyView(currentList)}</details>`
  } else if (page === 'lists') content = `<h1>${t('lists')}</h1>${listLinks()}`
  else if (page === 'today') content = `<h1>${t('today')}</h1>${dated(active())}<div class="addwrap">${button('+ ' + t('add'), 'new', 'add')}</div>`
  else if (page === 'mine') content = `<h1>${t('mine')}</h1><small>${t(includeUnassigned ? 'withunassigned' : 'ownonly')}</small>${dated(active().filter(isMine))}<h2>${t('upcoming')}</h2>${rows(active().filter(x => isMine(x) && (!x.due || x.due > today)))}<div class="addwrap">${button('+ ' + t('add'), 'new:Eric', 'add')}</div>`
  else content = variant === 'A' ? landingA() : variant === 'B' ? landingB() : landingC()
  $('#phone').innerHTML = `<div class="topbar">${button(page === 'landing' ? '⌂ Gather' : '‹ ' + t('tasks'), 'page:landing')}<span>Household</span>${button('☷', 'page:lists').replace('type="button"', `type="button" aria-label="${t('lists')}"`)}</div><div class="screen">${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ''}${Object.keys(drafts).length ? button(`${t('draft')} (${Object.keys(drafts).length})`, 'resume', 'draftbanner') : ''}${content}</div><div class="shell"><span><b>⌂</b>${t('home')}</span><span><b>♧</b>${t('pinned')}</span><span><b>⊕</b>${t('add')}</span><span class="active"><b>▦</b>${t('allmodules')}</span><span><b>⚙</b>${t('settings')}</span></div>`
  $('#switcher').innerHTML = `${button('←', 'variant:-1')}<span>${variant} · ${variants[variant][locale === 'nl' ? 1 : 0]}</span>${button('→', 'variant:1')}`
  renderInspector()
  renderModal()
}
function historyView(list) {
  const entries = history.filter(h => !list || h.list === list)
  return entries.length ? entries.map(h => `<p class="history"><b>${esc(h.title)}</b><br><small>${t('completed')}: ${h.completedAt}${h.next ? `<br>${t('next')}: ${h.next}` : ''}</small></p>`).join('') : `<p class="muted">${t('historyempty')}</p>`
}
function renderInspector() {
  $('#inspector').innerHTML = `<span class="eyebrow">Prototype controls · outside the app</span><h3>Unsettled choices</h3><label><input id="unassigned" type="checkbox" ${includeUnassigned ? 'checked' : ''}> Mine includes unassigned</label><p>Today includes overdue + due today. Mine includes all dates. A’s Mine segment narrows Today; B has an all-date Mine destination. Compare that distinction.</p><label><input id="provider" type="checkbox" ${providerDown ? 'checked' : ''}> Todoist outage</label><h3>Personal notification controls</h3><label><input id="reminders" type="checkbox" ${reminders ? 'checked' : ''}> Task reminders</label><label><input id="assignment" type="checkbox" ${assignmentNotifications ? 'checked' : ''}> Task assignment notifications</label><label><input id="muted" type="checkbox" ${muted ? 'checked' : ''}> Mute this Group</label><label><input id="permission" type="checkbox" ${permission ? 'checked' : ''}> Device permission allowed</label><h3>Row presentation</h3><label><input id="compact" type="checkbox" ${compact ? 'checked' : ''}> ${t('compact')}</label>${['due','priority','labels'].map(k => `<label><input data-display="${k}" type="checkbox" ${display[k] ? 'checked' : ''}> ${t(k + 'visible')}</label>`).join('')}<p>Child dates on repetition: held unchanged in this demo, explicitly NOT selected. History snapshots retain children for inspection; retention and recurring undo remain open. Early recurring completion is blocked pending design.</p><details><summary>History (${history.length})</summary>${historyView()}</details><details><summary>Full in-memory state</summary><pre id="state"></pre></details><p>Reference: user-supplied Todoist screenshot. Attachments and voice remain outside this exploration. Bulk rescheduling is a proposal, not an accepted behavior.</p>`
  updateState()
}
function updateState() {
  const el = $('#state')
  if (el) el.textContent = JSON.stringify({ variant, page, filter, today, includeUnassigned, providerDown, notifications: { reminders, assignmentNotifications, muted, permission }, display, tasks, drafts, currentDraft, history, unsettled: ['child dates on repeat','child history retention','recurring undo','early completion','provider field mapping','draft lifetime after restart','bulk reschedule policy'] }, null, 2)
}
function openDraft(task, who) {
  const id = task?.id || 'new'
  if (drafts[id]) currentDraft = drafts[id]
  else {
    currentDraft = copy(task || { id: 'new', title: '', list: page.startsWith('list-') ? page.slice(5) : 'home', due: '', who: who ?? '', repeat: '', reminder: '', priority: '', labels: '', notes: '', done: false, children: [] })
    drafts[id] = currentDraft
  }
  modal = 'editor'; render(); setTimeout(() => $('#task-title')?.focus(), 0)
}
function reminderStatus() {
  if (!currentDraft?.reminder) return t('noreminder')
  if (!reminders) return t('remindersoff')
  if (muted) return t('muted')
  if (!permission) return t('permission')
  return t('remindready')
}
function renderModal() {
  $('#overlay')?.remove()
  if (!modal) return
  const overlay = document.createElement('div'); overlay.id = 'overlay'; overlay.className = 'scrim'
  let inner = ''
  if (modal === 'editor') {
    const d = currentDraft, readOnly = !writable(d.list), limited = d.list === 'todoist', disabled = readOnly || pending
    inner = `<header>${button(t('close'), 'dismiss', '', pending)}<strong>${t(d.id === 'new' ? 'new' : 'edit')}</strong>${button(t('save'), 'save', 'primary', disabled)}</header><input class="titleinput" id="task-title" data-field="title" aria-label="${t('title')}" placeholder="${t('title')}" value="${esc(d.title)}" ${disabled ? 'disabled' : ''}>
      <div class="chips"><label class="chip">☷ ${select('list', lists.map(l => [l.id, listName(l.id)]), d.list, disabled || d.id !== 'new')}</label><span class="chip">▣ ${button(d.due ? dateText(d.due) : t('date'), 'date', '', disabled)}</span><label class="chip">⚑ ${select('priority', [['',t('normal')],['high',t('high')]], d.priority, disabled)}</label></div>
      ${readOnly ? `<p class="notice">${t(d.list === 'notion' ? 'readreason' : 'outage')}</p>` : ''}${limited ? `<p class="notice">${t('providerlimited')}</p>` : ''}
      <details id="editor-details" ${d.id !== 'new' ? 'open' : ''}><summary>${t('details')}</summary>
      <label class="field">${t('date')}<input id="due-input" data-field="due" type="date" value="${esc(d.due)}" ${disabled ? 'disabled' : ''}></label>
      <label class="field">${t('assignee')}${select('who', [['',t('unassigned')],['Eric',name('Eric')],['Anne','Anne']], d.who, disabled || limited)}</label>
      <label class="field">${t('repeat')}${select('repeat', [['',t('none')],['fixed',t('fixed')],['interval',t('interval')],['monthly',t('monthly')]], d.repeat, disabled || limited || !d.due)}</label>
      <label class="field">${t('reminder')}${select('reminder', [['',t('none')],['morning',t('morning')]], d.reminder, disabled || limited || !d.due)}</label><p class="muted" id="reminder-status">${reminderStatus()}</p>
      <label class="field">${t('labels')}<input data-field="labels" value="${esc(d.labels)}" ${disabled ? 'disabled' : ''}></label><label class="field">${t('notes')}<textarea data-field="notes" ${disabled ? 'disabled' : ''}>${esc(d.notes)}</textarea></label>
      <h2>${t('subtasks')}</h2>${d.children.map((c, i) => `<div class="child"><input aria-label="${t('title')} ${i + 1}" data-child="${i}:title" value="${esc(c.title)}" ${disabled || limited ? 'disabled' : ''}><div class="childfields"><select aria-label="${t('assignee')} ${i + 1}" data-child="${i}:who" ${disabled || limited ? 'disabled' : ''}>${options([['',t('unassigned')],['Eric',name('Eric')],['Anne','Anne']],c.who)}</select><input aria-label="${t('date')} ${i + 1}" data-child="${i}:due" type="date" value="${esc(c.due)}" ${disabled || limited ? 'disabled' : ''}></div><small>${c.done ? t('completed') : t('incomplete')}</small></div>`).join('')}${button('+ ' + t('child'), 'child', '', disabled || limited)}<p class="muted">${t('nochildrepeat')}</p></details>
      <small>${t('dismissdraft')}</small><p class="notice" id="editor-notice" hidden></p>`
  } else if (modal.startsWith('complete:')) inner = `<h2>${t('parentquestion')}</h2><p>${esc(tasks.find(x => x.id === modal.split(':')[1]).title)}</p><div class="actions">${button(t('all'), 'confirm:all', 'primary')}${button(t('parentonly'), 'confirm:parent')}${button(t('cancel'), 'cancel')}</div>`
  else if (modal === 'reschedule') inner = `<h2>${t('bulkquestion')}</h2><p>${t('bulkdetail')}</p><p>${bulkTasks().map(x => esc(x.title)).join('<br>') || t('empty')}</p><div class="actions">${button(t('save'), 'bulk-save', 'primary', !bulkTasks().length)}${button(t('cancel'), 'cancel')}</div>`
  overlay.innerHTML = `<section class="sheet" role="dialog" aria-modal="true" aria-label="${t('tasks')}">${inner}</section>`
  document.body.append(overlay)
}
const utc = (date) => new Date(`${date}T12:00:00Z`)
const iso = (date) => date.toISOString().slice(0, 10)
function plusDays(date, amount) { const d = utc(date); d.setUTCDate(d.getUTCDate() + amount); return iso(d) }
function nextDate(task) {
  if (task.repeat === 'interval') return plusDays(today, 7)
  if (task.repeat === 'fixed') { let next = plusDays(today, 1); while (utc(next).getUTCDay() !== 2) next = plusDays(next, 1); return next }
  if (task.repeat === 'monthly') { const d = utc(task.due); let year = d.getUTCFullYear(), month = d.getUTCMonth(); let next; do { month++; next = iso(new Date(Date.UTC(year, month + 1, 0, 12))); } while (next <= today); return next }
  return ''
}
async function acknowledge(list) {
  if (list !== 'todoist') return true
  if (providerDown) return false
  pending = true; notice = t('pending'); render()
  await new Promise(resolve => setTimeout(resolve, 650))
  pending = false
  return !providerDown
}
async function complete(id, children = null) {
  const task = tasks.find(x => x.id === id)
  if (!writable(task.list) || pending) return
  if (task.repeat && task.due > today) { notice = t('early'); render(); return }
  if (!task.done && task.children.some(c => !c.done) && children === null) { modal = `complete:${id}`; renderModal(); return }
  if (!await acknowledge(task.list)) { notice = t('outage'); render(); return }
  if (task.done) task.done = false
  else {
    if (children === 'all') task.children.forEach(c => { c.done = true })
    const next = nextDate(task)
    history.push({ ...copy(task), completedAt: today, next, childrenChoice: children })
    if (next) { task.due = next; task.children.forEach(c => { c.done = false }) }
    else task.done = true
    notice = `${t('completed')}: ${task.title}${next ? ` · ${t('next')}: ${dateText(next)}` : ''}`
  }
  modal = null; render()
}
function bulkTasks() { return active().filter(x => x.due && x.due < today && !x.repeat && writable(x.list) && (page !== 'mine' && !(page === 'landing' && filter === 'mine') || isMine(x))) }
async function saveDraft() {
  const d = currentDraft
  if (!d || !writable(d.list) || pending) return
  if (d.list === 'todoist' && (d.who || d.repeat || d.reminder || d.children.length)) { $('#editor-notice').hidden = false; $('#editor-notice').textContent = t('providerlimited'); return }
  if (!d.title.trim() || d.children.some(c => !c.title.trim())) { $('#editor-notice').hidden = false; $('#editor-notice').textContent = t('nameRequired'); return }
  if (!await acknowledge(d.list)) { notice = t('outage'); render(); return }
  const previous = tasks.find(x => x.id === d.id)
  const key = d.id
  const saved = copy(d); saved.title = saved.title.trim()
  if (saved.id === 'new') { saved.id = `task-${Date.now()}`; tasks.push(saved) }
  else tasks[tasks.findIndex(x => x.id === d.id)] = saved
  const assignment = saved.who && saved.who !== 'Eric' && previous?.who !== saved.who
  notice = t(d.list === 'todoist' ? 'acknowledged' : 'saved')
  // Preferences in this inspector belong to Eric, not Anne: never apply them to Anne.
  if (assignment) notice += locale === 'nl' ? ' · Toewijzing aan Anne; haar meldingsvoorkeuren bepalen de melding (simulatie).' : ' · Assigned to Anne; her notification preferences determine delivery (simulation).'
  delete drafts[key]; currentDraft = null; modal = null; render()
}
document.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]'); if (!target || target.disabled) return
  const [action, value] = target.dataset.action.split(':')
  if (action === 'variant') { variant = ['A','B','C'][(['A','B','C'].indexOf(variant) + Number(value) + 3) % 3]; const url = new URL(location.href); url.searchParams.set('variant', variant); window.history.replaceState(null, '', url); page = 'landing'; render() }
  else if (action === 'page') { page = value; notice = ''; render() }
  else if (action === 'filter') { filter = value; render() }
  else if (action === 'new') openDraft(null, value)
  else if (action === 'edit') openDraft(tasks.find(x => x.id === value))
  else if (action === 'resume') { currentDraft = Object.values(drafts)[0]; modal = 'editor'; render() }
  else if (action === 'dismiss') { currentDraft = null; modal = null; notice = t('draftkept'); render() }
  else if (action === 'save') await saveDraft()
  else if (action === 'complete') await complete(value)
  else if (action === 'confirm') await complete(modal.split(':')[1], value)
  else if (action === 'cancel') { modal = null; renderModal() }
  else if (action === 'date') { $('#editor-details').open = true; $('#due-input').focus(); $('#due-input').showPicker?.() }
  else if (action === 'child') { currentDraft.children.push({ id: `child-${Date.now()}`, title: '', who: '', due: '', done: false }); renderModal(); $('#editor-details').open = true; updateState() }
  else if (action === 'refresh') { notice = providerDown && page === 'list-todoist' ? t('outage') : (locale === 'nl' ? 'Voorbeeldgegevens vernieuwd (simulatie).' : 'Fixture data refreshed (simulation).'); render() }
  else if (action === 'reschedule') { modal = 'reschedule'; renderModal() }
  else if (action === 'bulk-save') { const items = bulkTasks(); if (items.some(x => x.list === 'todoist') && !await acknowledge('todoist')) { notice = t('outage'); modal = null; render(); return } items.forEach(x => { x.due = plusDays(today, 1) }); modal = null; notice = t('saved'); render() }
  else if (action === 'february') { tasks = copy(seed); today = '2026-01-31'; page = 'list-home'; history = []; drafts = {}; currentDraft = null; modal = null; notice = 'Monthly scenario: complete “Check the meter reading”.'; render() }
  else if (action === 'reset') { tasks = copy(seed); history = []; drafts = {}; currentDraft = null; modal = null; notice = ''; today = '2026-09-16'; providerDown = false; page = 'landing'; render() }
})
document.addEventListener('input', event => {
  const el = event.target
  if (el.dataset.field && currentDraft) {
    currentDraft[el.dataset.field] = el.value
    if (el.dataset.field === 'due' && !el.value) { currentDraft.repeat = ''; currentDraft.reminder = '' }
    updateState()
  }
  if (el.dataset.child && currentDraft) { const [index, field] = el.dataset.child.split(':'); currentDraft.children[index][field] = el.value; updateState() }
})
document.addEventListener('change', event => {
  const el = event.target
  if (el.dataset.field && ['list','due','reminder'].includes(el.dataset.field)) { const open = $('#editor-details')?.open; renderModal(); if (open) $('#editor-details').open = true; updateState(); return }
  if (el.id === 'locale') locale = el.value
  else if (el.id === 'dark') document.body.classList.toggle('dark', el.checked)
  else if (el.id === 'large') document.body.classList.toggle('large', el.checked)
  else if (el.id === 'today') { if (!el.value) return; today = el.value }
  else if (el.id === 'unassigned') includeUnassigned = el.checked
  else if (el.id === 'provider') providerDown = el.checked
  else if (el.id === 'reminders') reminders = el.checked
  else if (el.id === 'assignment') assignmentNotifications = el.checked
  else if (el.id === 'muted') muted = el.checked
  else if (el.id === 'permission') permission = el.checked
  else if (el.id === 'compact') compact = el.checked
  else if (el.dataset.display) display[el.dataset.display] = el.checked
  else return
  render()
})
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && modal && !pending) { modal = null; currentDraft = null; notice = t('draftkept'); render(); return }
  if (event.target.closest('input, textarea, select, [contenteditable]') || modal) return
  if (['ArrowLeft','ArrowRight'].includes(event.key)) { event.preventDefault(); $(`[data-action="variant:${event.key === 'ArrowLeft' ? '-1' : '1'}"]`).click() }
})
render()
