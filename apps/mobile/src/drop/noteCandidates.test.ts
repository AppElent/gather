import { expect, test } from 'vitest'
import { asksServer, pickableNotes } from './noteCandidates'

const note = (id: string, title: string) => ({ _id: id, title, body: '' })
const recent = [note('1', 'Boiler manual'), note('2', '')]
const pick = (
  query: string,
  from: typeof recent | undefined,
  found?: typeof recent,
) => pickableNotes(query, from, found, 'Untitled note')?.map((each) => each._id)

test('nothing typed offers the recent notes', () => {
  expect(pick('', recent)).toEqual(['1', '2'])
  expect(pick(' ', undefined)).toBeUndefined()
})

test('a recent title matches at once, before the server answers', () => {
  expect(pick('oiler', recent)).toEqual(['1'])
  expect(pick('untitled', recent)).toEqual(['2'])
})

test("the server's matches follow, each note once", () => {
  expect(
    pick('boiler', recent, [note('1', 'Boiler manual'), note('9', 'Old boiler')]),
  ).toEqual(['1', '9'])
})

test('is still loading, not empty, until the server has answered', () => {
  expect(pick('wifi', recent)).toBeUndefined()
  expect(pick('wifi', recent, [])).toEqual([])
  expect(pick('w', recent)).toEqual([])
  expect(pick('w', undefined)).toBeUndefined()
})

test('a letter that lowercases to two is still one, and waits for nothing', () => {
  expect(asksServer(' İ ')).toBe(false)
  expect(asksServer('wi')).toBe(true)
  expect(pick('İ', recent)).toEqual([])
})
