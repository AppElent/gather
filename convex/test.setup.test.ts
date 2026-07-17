import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import schema from './schema'
import { modules } from './test.setup'

test('loads the Convex schema in the edge-runtime project', async () => {
  const t = convexTest(schema, modules)
  const count = await t.run((ctx) => ctx.db.query('users').collect())
  expect(count).toEqual([])
})
