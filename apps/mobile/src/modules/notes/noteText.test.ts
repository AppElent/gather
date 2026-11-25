import { afterEach, expect, test, vi } from 'vitest'
import { noteWhen, unsavedText } from './noteText'

afterEach(() => vi.useRealTimers())

test('only the fields that differ from the saved note', () => {
  const saved = { title: 'T', body: 'b' }
  expect(unsavedText(saved, { title: 'T', body: 'c' })).toEqual({ body: 'c' })
  expect(unsavedText(saved, { title: '' })).toEqual({ title: '' })
  expect(unsavedText(saved, {})).toEqual({})
})

test("noteWhen uses the Group's day and clock when a zone is set", () => {
  // 22:30Z on 24 Nov: 24 Nov in Amsterdam, 25 Nov in Tokyo.
  vi.useFakeTimers()
  vi.setSystemTime(Date.parse('2026-11-24T22:30:00Z'))
  // 14:00Z on 24 Nov is 23:00 on 24 Nov in Tokyo (yesterday there) and 15:00 on 24 Nov in Amsterdam (today).
  const earlier = Date.parse('2026-11-24T14:00:00Z')
  expect(noteWhen(earlier, 'en', 'Today', 'Europe/Amsterdam')).toContain('Today')
  expect(noteWhen(earlier, 'en', 'Today', 'Asia/Tokyo')).not.toContain('Today')
  // 21:00Z on 24 Nov is 06:00 on 25 Nov in Tokyo (today there).
  const recent = Date.parse('2026-11-24T21:00:00Z')
  expect(noteWhen(recent, 'en', 'Today', 'Asia/Tokyo')).toContain('Today')
  expect(noteWhen(recent, 'en', 'Today', 'Asia/Tokyo')).toContain('06:00')
})
