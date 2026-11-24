import type { MenuAction } from '@expo/ui/community/menu'
import { expect, test } from 'vitest'

import { type ComposerMoreItem, composerMoreMenu } from './composer-menu'

/** Every item a person can pick, with the sections opened up. */
const leaves = (actions: readonly MenuAction[]): MenuAction[] =>
  actions.flatMap((action) =>
    action.displayInline && action.subactions ? leaves(action.subactions) : [action],
  )

const items: ComposerMoreItem[] = [
  { id: 'more:description', title: 'Description', image: 'text.alignleft' },
  {
    id: 'more:priority',
    title: 'Priority',
    image: 'flag',
    subactions: [{ id: 'priority:1', title: 'High' }],
  },
]
const allDetails: ComposerMoreItem = {
  id: 'more:all',
  title: 'All details',
  image: 'arrow.up.forward.square',
}

test('every item in the + menu has an icon, All details included', () => {
  const menu = composerMoreMenu(items, allDetails)
  expect(leaves(menu).map((action) => action.id)).toEqual([
    'more:description',
    'more:priority',
    'more:all',
  ])
  for (const action of leaves(menu)) expect(action.image).toBeTruthy()
})

test('All details sits in a section of its own, after a separator', () => {
  const menu = composerMoreMenu(items, allDetails)
  expect(menu.at(-1)).toMatchObject({ displayInline: true, subactions: [allDetails] })
  expect(composerMoreMenu(items)).toEqual(items)
})

test('an item without an icon does not compile', () => {
  // @ts-expect-error: `image` is required.
  const bare: ComposerMoreItem = { id: 'more:label', title: 'Label' }
  expect(bare.image).toBeUndefined()
})
