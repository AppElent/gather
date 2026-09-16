// THROWAWAY: shared by prototype routes only. No storage, backend or provider API.
import { useSyncExternalStore } from 'react'

export type SampleTask = {
  id: string
  title: string
  list: string
  due: string
  who: string
  done: boolean
  repeat: string
  reminder: boolean
  high: boolean
  labels: string
  notes: string
  children: SampleTask[]
  revision: number
}
export const sampleLists = [
  'household',
  'groceries',
  'baby',
  'weekend',
  'moving',
] as const
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
export const blank = (
  id: string,
  title = '',
  list = 'household',
): SampleTask => ({
  id,
  title,
  list,
  due: '',
  who: '',
  done: false,
  repeat: '',
  reminder: false,
  high: false,
  labels: '',
  notes: '',
  children: [],
  revision: 0,
})
function fixtures(): SampleTask[] {
  return [
    {
      ...blank('plumber', 'Call the plumber'),
      due: '2026-09-14',
      who: 'Eric',
      high: true,
      labels: 'house',
    },
    {
      ...blank('bins', 'Put the bins out'),
      due: '2026-09-15',
      who: 'Eric',
      repeat: 'fixed',
    },
    {
      ...blank('bathroom', 'Clean the bathroom'),
      due: '2026-09-13',
      who: 'Anne',
      repeat: 'interval',
      children: [
        {
          ...blank('sink', 'Clean the sink'),
          due: '2026-09-13',
          who: 'Eric',
          done: true,
        },
        {
          ...blank('towels', 'Change the towels'),
          due: '2026-09-14',
          who: 'Anne',
        },
      ],
    },
    {
      ...blank('parcel', 'Collect the parcel'),
      due: '2026-09-16',
      who: 'Anne',
    },
    { ...blank('plants', 'Water the plants'), due: '2026-09-16' },
    { ...blank('insurance', 'Compare home insurance'), who: 'Eric' },
    {
      ...blank('meter', 'Check the meter reading'),
      due: '2026-01-31',
      who: 'Eric',
      repeat: 'monthly',
    },
    blank('milk', 'Oat milk', 'groceries'),
    blank('bread', 'Sourdough bread', 'groceries'),
    blank('bag', 'Pack the changing bag', 'baby'),
    {
      ...blank('tickets', 'Book museum tickets', 'weekend'),
      due: '2026-09-16',
    },
    {
      ...blank('address', 'Update our address', 'moving'),
      due: '2026-09-14',
      who: 'Eric',
    },
  ]
}
type SampleState = {
  tasks: SampleTask[]
  draft: SampleTask | null
  today: string
  history: { task: SampleTask; date: string; next: string }[]
  mineUnassigned: boolean
  providerDown: boolean
  reminders: boolean
  mute: boolean
}
const fresh = (): SampleState => ({
  tasks: fixtures(),
  draft: null,
  today: '2026-09-16',
  history: [],
  mineUnassigned: false,
  providerDown: false,
  reminders: true,
  mute: false,
})
let state = fresh()
const listeners = new Set<() => void>()
export function patchSample(patch: Partial<SampleState>) {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}
export function useSample() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => state,
    () => state,
  )
}
export const sampleNow = () => state
export const resetSample = () => patchSample(fresh())
export const writable = (list: string) =>
  list !== 'moving' && !(list === 'weekend' && state.providerDown)
export function plusDays(day: string, days: number) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export function completeSample(id: string, includeChildren: boolean) {
  const task = clone(state.tasks.find((t) => t.id === id)!)
  if (!writable(task.list)) return
  let next = ''
  if (!task.done) {
    if (includeChildren)
      task.children.forEach((c) => {
        c.done = true
      })
    if (task.repeat === 'interval') next = plusDays(state.today, 7)
    if (task.repeat === 'fixed') {
      next = plusDays(state.today, 1)
      while (new Date(`${next}T12:00:00Z`).getUTCDay() !== 2)
        next = plusDays(next, 1)
    }
    if (task.repeat === 'monthly') {
      const d = new Date(`${task.due}T12:00:00Z`)
      let month = d.getUTCMonth()
      do {
        month++
        next = new Date(Date.UTC(d.getUTCFullYear(), month + 1, 0, 12))
          .toISOString()
          .slice(0, 10)
      } while (next <= state.today)
    }
    state = {
      ...state,
      history: [
        ...state.history,
        { task: clone(task), date: state.today, next },
      ],
    }
    if (next) {
      task.due = next
      task.children.forEach((c) => {
        c.done = false
      })
    } else task.done = true
  } else task.done = false
  task.revision++
  patchSample({ tasks: state.tasks.map((t) => (t.id === id ? task : t)) })
}
