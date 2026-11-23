/**
 * The keyboard composer's + menu (APP-587, APP-661): the details not always
 * on the chip row, then All details in a section of its own.
 *
 * Every item wears an SF Symbol, as every chip wears an icon: the type asks
 * for one, so a kind cannot add an item without it.
 */
import type { MenuAction } from '@expo/ui/community/menu'

/** Its icon: an SF Symbol name on iOS. */
export type ComposerMoreIcon = NonNullable<MenuAction['image']>

/** One + menu item: a detail to set, or a submenu of its values. */
export interface ComposerMoreItem extends MenuAction {
  id: string
  image: ComposerMoreIcon
}

/** The menu the + button opens: the items, a separator, then All details. */
export function composerMoreMenu(
  items: readonly ComposerMoreItem[],
  allDetails?: ComposerMoreItem,
): MenuAction[] {
  if (!allDetails) return [...items]
  return [
    ...items,
    { id: 'more:end', title: '', displayInline: true, subactions: [allDetails] },
  ]
}
