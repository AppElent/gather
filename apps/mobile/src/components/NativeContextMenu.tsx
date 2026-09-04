import { type MenuAction, MenuView } from '@expo/ui/community/menu'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

import { haptics } from '../feedback/haptics'

/**
 * Platform menu with UI-only actions; callers retain their data ownership.
 *
 * **Hold is the default and stays the default** (`docs/mobile-interaction.md`):
 * holding any row opens its menu, everywhere, and the gesture never means
 * anything else.
 *
 * `trigger="press"` is for the one shape that is not a row — an overflow
 * control in a navigation bar, which is a button and has to open on a tap.
 * Holding a `⋯` does nothing anybody would guess, and there is no competing
 * meaning for the tap to take away.
 *
 * **`style` is not optional decoration.** The trigger wrapper is a real view in
 * the layout, and it has no flex of its own: in a column it stretches like any
 * other child, but in a **row** it sizes to whatever is inside it. That is why
 * two menu-wrapped tiles side by side come out as wide as their labels instead
 * of as wide as their column, and why anything laid out along a row passes
 * `{ flex: 1 }` through here.
 */
export function NativeContextMenu({
  actions,
  children,
  onAction,
  style,
  trigger = 'hold',
}: {
  actions: readonly MenuAction[]
  children: ReactNode
  onAction: (id: string) => void
  style?: StyleProp<ViewStyle>
  trigger?: 'hold' | 'press'
}) {
  return (
    <MenuView
      style={style}
      shouldOpenOnLongPress={trigger === 'hold'}
      actions={[...actions]}
      onOpenMenu={() => haptics.menuOpened()}
      onPressAction={(event) => onAction(event.nativeEvent.event)}
    >
      {children}
    </MenuView>
  )
}
