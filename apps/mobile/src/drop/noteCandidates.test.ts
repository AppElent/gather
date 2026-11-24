import { expect, test } from 'vitest'
import { asksServer, bodyExcerpt, pickableNotes } from './noteCandidates'

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

const withBody = (title: string, body: string) => ({ _id: 'n', title, body })
const excerpt = (title: string, body: string, query: string) =>
  bodyExcerpt(withBody(title, body), query, 'Untitled note')

test('a body match shows the text around the hit, for a short body in full', () => {
  expect(excerpt('Router', 'The wifi password is on the fridge', 'password')).toBe(
    'The wifi password is on the fridge',
  )
})

test('a long body is cut around the hit, with an ellipsis on each cut side', () => {
  const body = `${'Lorem ipsum dolor sit amet '.repeat(6)}the boiler code is 1234 ${'and more text '.repeat(8)}`
  const out = excerpt('House', body, 'boiler') ?? ''
  expect(out.startsWith('…')).toBe(true)
  expect(out.endsWith('…')).toBe(true)
  expect(out).toContain('boiler code is 1234')
  expect(out.length).toBeLessThanOrEqual(82)
  // Starts on a word, not inside one.
  expect(out.startsWith('… ')).toBe(false)
  expect(/^…[A-Za-z]/.test(out)).toBe(true)
})

test('matches case-insensitively, inside words, in other scripts, and across lines', () => {
  expect(excerpt('Huis', 'Zet de\nCV-KETEL aan', 'ketel')).toBe('Zet de CV-KETEL aan')
  expect(excerpt('Eten', 'Een aardappelsoep maken', 'soep')).toBe(
    'Een aardappelsoep maken',
  )
  expect(excerpt('メモ', '買い物リストに牛乳を追加', '牛乳')).toBe(
    '買い物リストに牛乳を追加',
  )
})

test('a letter that lowercases to two does not shift the excerpt', () => {
  const body = `${'İ'.repeat(30)} then the target word`
  const out = excerpt('T', body, 'target') ?? ''
  expect(out).toContain('target word')
})

test('shows nothing when the title already explains the match, or the body has no hit', () => {
  expect(excerpt('Boiler manual', 'Read the boiler code', 'boiler')).toBeNull()
  expect(excerpt('', 'Nothing here', 'untitled')).toBeNull()
  expect(excerpt('Router', 'Nothing here', 'wifi')).toBeNull()
  expect(excerpt('Router', 'Body', '')).toBeNull()
})

test('with several words, shows where a word the title lacks is', () => {
  expect(excerpt('Boiler', 'Service the unit in March', 'boiler march')).toBe(
    'Service the unit in March',
  )
})
