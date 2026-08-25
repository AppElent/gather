import { describe, expect, test, vi } from 'vitest'

import type { Id } from '../../../../../convex/_generated/dataModel'

vi.mock('../../group/GroupProvider', () => ({ useGroup: vi.fn() }))

import { localTaskQueries } from './store'

describe('localTaskQueries', () => {
  test('builds requests only for local lists in the active Group', () => {
    expect(
      localTaskQueries(
        [
          { _id: 'local-list' as Id<'taskLists'>, provider: 'local' },
          { _id: 'notion-list' as Id<'taskLists'>, provider: 'notion' },
        ],
        'our-household',
      ),
    ).toEqual({
      'local-list': {
        query: expect.anything(),
        args: { listId: 'local-list', groupSlug: 'our-household' },
      },
    })
  })
})
