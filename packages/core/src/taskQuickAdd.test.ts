import { describe, expect, it } from 'vitest'
import { parseQuickAdd, type QuickAdd, type QuickAddContext } from './taskQuickAdd'

// Wednesday 18 November 2026, ten in the morning.
const ctx: QuickAddContext = {
  today: '2026-11-18',
  now: '10:00',
  members: [
    { id: 'u-eric', name: 'Eric Jansen' },
    { id: 'u-daan', name: 'Daan' },
    { id: 'u-zoe', name: 'Zoë de Vries' },
    { id: 'u-sam1', name: 'Sam Bakker' },
    { id: 'u-sam2', name: 'Sam Visser' },
  ],
}

const parse = (text: string, extra: Partial<QuickAddContext> = {}) =>
  parseQuickAdd(text, { ...ctx, ...extra })

type Expected = Partial<Omit<QuickAdd, 'parts'>>

/** What a line becomes: the title, and only the fields it should set. */
const cases: [string, Expected][] = [
  // ---- the issue's own example
  [
    'stofzuigen morgen elke week @Eric',
    {
      title: 'stofzuigen',
      dueDate: '2026-11-19',
      repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [4] },
      assigneeId: 'u-eric',
    },
  ],
  // ---- relative days
  ['Bins out today', { title: 'Bins out', dueDate: '2026-11-18' }],
  ['Vuilnis vandaag', { title: 'Vuilnis', dueDate: '2026-11-18' }],
  ['Call mum tomorrow', { title: 'Call mum', dueDate: '2026-11-19' }],
  ['Bel oma morgen', { title: 'Bel oma', dueDate: '2026-11-19' }],
  ['Ramen lappen overmorgen', { title: 'Ramen lappen', dueDate: '2026-11-20' }],
  [
    'Pay rent the day after tomorrow',
    { title: 'Pay rent', dueDate: '2026-11-20' },
  ],
  ['Pizza bestellen vanavond', { title: 'Pizza bestellen', dueDate: '2026-11-18' }],
  // ---- weekdays
  ['Gym on Friday', { title: 'Gym', dueDate: '2026-11-20' }],
  ['Sporten vrijdag', { title: 'Sporten', dueDate: '2026-11-20' }],
  ['Boodschappen op zaterdag', { title: 'Boodschappen', dueDate: '2026-11-21' }],
  // Today is Wednesday: plain Wednesday is today, next Wednesday a week on.
  ['Water plants wednesday', { title: 'Water plants', dueDate: '2026-11-18' }],
  ['Water plants next Wednesday', { title: 'Water plants', dueDate: '2026-11-25' }],
  ['Planten volgende woensdag', { title: 'Planten', dueDate: '2026-11-25' }],
  ['Fietsen maandag', { title: 'Fietsen', dueDate: '2026-11-23' }],
  // ---- weeks, weekends, months
  ['Plan holiday next week', { title: 'Plan holiday', dueDate: '2026-11-23' }],
  ['Vakantie plannen volgende week', { title: 'Vakantie plannen', dueDate: '2026-11-23' }],
  ['Clean garage this weekend', { title: 'Clean garage', dueDate: '2026-11-21' }],
  ['Schuur opruimen dit weekend', { title: 'Schuur opruimen', dueDate: '2026-11-21' }],
  ['Auto wassen volgend weekend', { title: 'Auto wassen', dueDate: '2026-11-28' }],
  ['Budget next month', { title: 'Budget', dueDate: '2026-12-01' }],
  ['Belasting volgende maand', { title: 'Belasting', dueDate: '2026-12-01' }],
  ['Check tyres in 3 days', { title: 'Check tyres', dueDate: '2026-11-21' }],
  ['Banden checken over 2 weken', { title: 'Banden checken', dueDate: '2026-12-02' }],
  ['Renew passport in a month', { title: 'Renew passport', dueDate: '2026-12-18' }],
  // ---- calendar dates (day first)
  ['Tandarts 12/3', { title: 'Tandarts', dueDate: '2027-03-12' }],
  ['Dentist on 24-12', { title: 'Dentist', dueDate: '2026-12-24' }],
  ['Verjaardag 1/2/2028', { title: 'Verjaardag', dueDate: '2028-02-01' }],
  ['Tandarts op 12 maart', { title: 'Tandarts', dueDate: '2027-03-12' }],
  ['Kapper 3 dec', { title: 'Kapper', dueDate: '2026-12-03' }],
  ['Party on March 12', { title: 'Party', dueDate: '2027-03-12' }],
  ['Party December 31st', { title: 'Party', dueDate: '2026-12-31' }],
  ['Concert 5th of June 2027', { title: 'Concert', dueDate: '2027-06-05' }],
  ['Leap 29 feb', { title: 'Leap', dueDate: '2028-02-29' }],
  // ---- times
  ['Call Anna at 15:30', { title: 'Call Anna', dueDate: '2026-11-18', time: '15:30' }],
  ['Bel Anna om 9:15', { title: 'Bel Anna', dueDate: '2026-11-19', time: '09:15' }],
  ['Medicijnen om 20 uur', { title: 'Medicijnen', dueDate: '2026-11-18', time: '20:00' }],
  ['Pills 8pm', { title: 'Pills', dueDate: '2026-11-18', time: '20:00' }],
  ['Meeting tomorrow at 9am', { title: 'Meeting', dueDate: '2026-11-19', time: '09:00' }],
  ['Vergadering morgen om 14.30', { title: 'Vergadering', dueDate: '2026-11-19', time: '14:30' }],
  ['Oppas vrijdag 18u', { title: 'Oppas', dueDate: '2026-11-20', time: '18:00' }],
  // ---- repeats
  ['Vacuum every week', { title: 'Vacuum', dueDate: '2026-11-18', repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [3] } }],
  ['Water geven dagelijks', { title: 'Water geven', dueDate: '2026-11-18', repeat: { mode: 'fixed', unit: 'day', every: 1 } }],
  ['Feed fish daily', { title: 'Feed fish', dueDate: '2026-11-18', repeat: { mode: 'fixed', unit: 'day', every: 1 } }],
  ['Bedden verschonen elke 2 weken', { title: 'Bedden verschonen', dueDate: '2026-11-18', repeat: { mode: 'fixed', unit: 'week', every: 2, weekdays: [3] } }],
  ['Change sheets every other week', { title: 'Change sheets', dueDate: '2026-11-18', repeat: { mode: 'fixed', unit: 'week', every: 2, weekdays: [3] } }],
  ['Badkamer om de week', { title: 'Badkamer', dueDate: '2026-11-18', repeat: { mode: 'fixed', unit: 'week', every: 2, weekdays: [3] } }],
  ['Oven om de 3 maanden', { title: 'Oven', dueDate: '2026-11-18', repeat: { mode: 'fixed', unit: 'month', every: 3, monthDay: 18 } }],
  ['Pay rent monthly', { title: 'Pay rent', dueDate: '2026-11-18', repeat: { mode: 'fixed', unit: 'month', every: 1, monthDay: 18 } }],
  ['Huur elke maand', { title: 'Huur', dueDate: '2026-11-18', repeat: { mode: 'fixed', unit: 'month', every: 1, monthDay: 18 } }],
  ['Boiler check every year', { title: 'Boiler check', dueDate: '2026-11-18', repeat: { mode: 'fixed', unit: 'year', every: 1, month: 11, monthDay: 18 } }],
  ['Papier elke maandag', { title: 'Papier', dueDate: '2026-11-23', repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [1] } }],
  ['Gym every Monday and Thursday', { title: 'Gym', dueDate: '2026-11-19', repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [1, 4] } }],
  ['Hardlopen iedere dinsdag en vrijdag', { title: 'Hardlopen', dueDate: '2026-11-20', repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [2, 5] } }],
  ['Yoga on Saturdays', { title: 'Yoga', dueDate: '2026-11-21', repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [6] } }],
  ['Lunch maken elke werkdag', { title: 'Lunch maken', dueDate: '2026-11-18', repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [1, 2, 3, 4, 5] } }],
  ['Uitslapen elk weekend', { title: 'Uitslapen', dueDate: '2026-11-21', repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [6, 7] } }],
  // A number after # is not a label.
  ['Order #12 for the shop', { title: 'Order #12 for the shop' }],
  ['Box #3a #2026q1', { title: 'Box', labels: ['3a', '2026q1'] }],
  // A weekday repeat with only a time is due on its first day, not today.
  ['Vuilnis elke dinsdag om 19:30', { title: 'Vuilnis', dueDate: '2026-11-24', time: '19:30', repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [2] } }],
  ['Gym every Wednesday at 8:00', { title: 'Gym', dueDate: '2026-11-25', time: '08:00', repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [3] } }],
  // A date anchors the repeat: tomorrow is a Thursday.
  ['Bins tomorrow weekly', { title: 'Bins', dueDate: '2026-11-19', repeat: { mode: 'fixed', unit: 'week', every: 1, weekdays: [4] } }],
  ['Huur 1/12 elke maand', { title: 'Huur', dueDate: '2026-12-01', repeat: { mode: 'fixed', unit: 'month', every: 1, monthDay: 1 } }],
  // ---- members
  ['Afwassen @Daan', { title: 'Afwassen', assigneeId: 'u-daan' }],
  ['Dishes @daan tonight', { title: 'Dishes', assigneeId: 'u-daan', dueDate: '2026-11-18' }],
  ['Bake cake @Zoe', { title: 'Bake cake', assigneeId: 'u-zoe' }],
  ['Taxes @Eric Jansen', { title: 'Taxes', assigneeId: 'u-eric' }],
  // Two Sams: the first name alone is nobody, the full name is one.
  ['Walk dog @Sam', { title: 'Walk dog @Sam' }],
  ['Walk dog @Sam Visser', { title: 'Walk dog', assigneeId: 'u-sam2' }],
  ['Mail @nobody', { title: 'Mail @nobody' }],
  ['Mail eric@example.com', { title: 'Mail eric@example.com' }],
  // ---- labels
  ['Lamp kopen #ikea', { title: 'Lamp kopen', labels: ['ikea'] }],
  ['Fix tap #home #urgent', { title: 'Fix tap', labels: ['home', 'urgent'] }],
  ['Learn C# basics', { title: 'Learn C# basics', labels: [] }],
  // ---- everything at once
  [
    'Gras maaien zaterdag om 10:00 elke 2 weken @Daan #tuin',
    {
      title: 'Gras maaien',
      dueDate: '2026-11-21',
      time: '10:00',
      repeat: { mode: 'fixed', unit: 'week', every: 2, weekdays: [6] },
      assigneeId: 'u-daan',
      labels: ['tuin'],
    },
  ],
  // ---- words that are no part
  ['Goedemorgen zeggen', { title: 'Goedemorgen zeggen' }],
  ['Read Morgenster', { title: 'Read Morgenster' }],
  ['Buy 2 eggs', { title: 'Buy 2 eggs' }],
  ['Cost 1.50', { title: 'Cost 1.50' }],
  ['Weekend bag', { title: 'Weekend bag' }],
  ['Price 32/45', { title: 'Price 32/45' }],
  ['Groceries', { title: 'Groceries', labels: [] }],
]

describe('parseQuickAdd', () => {
  it('has at least 40 phrases in English and Dutch', () => {
    expect(cases.length).toBeGreaterThanOrEqual(40)
  })

  it.each(cases)('%s', (text, expected) => {
    const result = parse(text)
    const { parts: _parts, ...fields } = result
    const want: Expected = { labels: [], ...expected }
    expect(fields).toEqual(want)
  })

  it('marks each part where it is in the line', () => {
    const text = 'Bins morgen @Daan #home'
    const { parts } = parse(text)
    expect(parts.map((p) => [p.kind, text.slice(p.start, p.end)])).toEqual([
      ['date', 'morgen'],
      ['member', '@Daan'],
      ['label', '#home'],
    ])
  })

  it('keeps the first date and leaves a second one in the title', () => {
    expect(parse('Move vrijdag of zaterdag')).toMatchObject({
      title: 'Move of zaterdag',
      dueDate: '2026-11-20',
    })
  })

  it('leaves a dismissed part as text in the title', () => {
    const first = parse('Bel morgen @Daan')
    const date = first.parts.find((p) => p.kind === 'date')
    expect(date?.key).toBe('date:morgen')
    const again = parse('Bel morgen @Daan', { dismissed: [date?.key ?? ''] })
    expect(again.title).toBe('Bel morgen')
    expect(again.dueDate).toBeUndefined()
    expect(again.assigneeId).toBe('u-daan')
  })

  it('reads a time that has passed today as tomorrow', () => {
    expect(parse('Pills at 9:00', { now: '21:00' }).dueDate).toBe('2026-11-19')
    expect(parse('Pills at 22:00', { now: '21:00' }).dueDate).toBe('2026-11-18')
  })

  it('refuses dates and times that do not exist', () => {
    expect(parse('X 31/4').title).toBe('X 31/4')
    expect(parse('X at 25:00').title).toBe('X at 25:00')
    expect(parse('X 13pm').title).toBe('X 13pm')
  })

  it('recognises a date already passed this year as next year', () => {
    expect(parse('Feest 1 januari').dueDate).toBe('2027-01-01')
    expect(parse('Feest 18 november').dueDate).toBe('2026-11-18')
  })

  it('reads nothing without members as a member', () => {
    expect(parse('Afwassen @Daan', { members: [] }).title).toBe('Afwassen @Daan')
  })

  it('keeps a label once when it is typed twice', () => {
    expect(parse('Fix #home #Home').labels).toEqual(['home'])
  })

  it('leaves an empty title when the line is only parts', () => {
    expect(parse('morgen @Daan')).toMatchObject({ title: '', dueDate: '2026-11-19' })
  })
})
