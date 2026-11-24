import type { App } from '@modelcontextprotocol/ext-apps'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { WeekAgendaResult } from '../types'
import { localToday, viewText } from './i18n'
import { WeekAgenda } from './WeekAgenda'

beforeEach(() => {
  // Noon UTC: the 18th at UTC+14.
  vi.useFakeTimers({ now: new Date('2026-11-17T12:00:00Z') })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function highlighted(timeZone?: string) {
  const result: WeekAgendaResult = {
    view: 'week-agenda',
    groupId: 'group_1',
    groupName: 'Thuis',
    weekStart: '2026-11-16',
    previousWeekStart: '2026-11-09',
    nextWeekStart: '2026-11-23',
    isCurrentWeek: true,
    today: '2026-11-17',
    timeZone,
    days: ['16', '17', '18'].map((day) => ({
      date: `2026-11-${day}`,
      events: [],
    })),
    truncated: false,
  }
  const { container } = render(
    <WeekAgenda
      app={{} as App}
      result={result}
      text={viewText('en')}
      reload={vi.fn()}
      header={null}
    />,
  )
  return [...container.querySelectorAll('.agenda-day')].findIndex((day) =>
    day.hasAttribute('data-today'),
  )
}

it("highlights today in the Group's zone, not the viewer's", () => {
  expect(highlighted('Pacific/Kiritimati')).toBe(2)
})

it("highlights the viewer's day when the Group has no zone", () => {
  expect(highlighted()).toBe(Number(localToday().slice(-2)) - 16)
})
