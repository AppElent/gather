import { describe, expect, test } from 'vitest'

import {
  collectExport,
  EXPORT_FORMAT,
  type ExportPageRequest,
  exportFileName,
  serializeExport,
} from '../dataExport'

describe('collectExport', () => {
  test('drains every page of every table, account first, then each Group', async () => {
    const requests: ExportPageRequest[] = []
    const data = await collectExport(
      {
        manifest: async () => ({
          version: 1,
          account: ['users'],
          group: ['notes'],
          excluded: [{ table: 'seedRuns', reason: 'bookkeeping' }],
          omittedFields: {},
          groups: [
            { slug: 'a', name: 'A' },
            { slug: 'b', name: 'B' },
          ],
        }),
        page: async (request) => {
          requests.push(request)
          const second = request.cursor === 'next'
          return {
            rows: [{ id: `${request.groupSlug ?? 'me'}-${second ? 2 : 1}` }],
            cursor: second ? null : 'next',
            isDone: second,
          }
        },
      },
      { now: new Date('2026-10-18T08:00:00Z') },
    )

    expect(requests.map((r) => [r.table, r.groupSlug, r.cursor])).toEqual([
      ['users', undefined, null],
      ['users', undefined, 'next'],
      ['notes', 'a', null],
      ['notes', 'a', 'next'],
      ['notes', 'b', null],
      ['notes', 'b', 'next'],
    ])
    if (!data) throw new Error('no export')
    expect(data.format).toBe(EXPORT_FORMAT)
    expect(data.account.users).toEqual([{ id: 'me-1' }, { id: 'me-2' }])
    expect(data.groups.map((g) => [g.slug, g.tables.notes.length])).toEqual([
      ['a', 2],
      ['b', 2],
    ])
    expect(serializeExport(data).startsWith('{\n  "format"')).toBe(true)
  })

  test('is nothing for somebody signed out', async () => {
    const data = await collectExport({
      manifest: async () => null,
      page: async () => {
        throw new Error('unreachable')
      },
    })
    expect(data).toBeNull()
  })
})

test('the file is named for the local day', () => {
  expect(exportFileName(new Date(2026, 0, 5, 23, 30))).toBe(
    'gather-export-2026-01-05.json',
  )
})
