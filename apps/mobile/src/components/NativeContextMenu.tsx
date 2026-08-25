import { type MenuAction, MenuView } from '@expo/ui/community/menu'
import type { ReactNode } from 'react'

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
 */
export function NativeContextMenu({
  actions,
  children,
  onAction,
  trigger = 'hold',
}: {
  actions: readonly MenuAction[]
  children: ReactNode
  onAction: (id: string) => void
  trigger?: 'hold' | 'press'
}) {
  return (
    <MenuView
      shouldOpenOnLongPress={trigger === 'hold'}
      actions={[...actions]}
      onOpenMenu={() => haptics.menuOpened()}
      onPressAction={(event) => onAction(event.nativeEvent.event)}
    >
      {children}
    </MenuView>
  )
}
