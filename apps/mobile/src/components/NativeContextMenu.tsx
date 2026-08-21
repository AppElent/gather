import { type MenuAction, MenuView } from '@expo/ui/community/menu'
import type { ReactNode } from 'react'

import { haptics } from '../feedback/haptics'

/** Platform long-press menu with UI-only actions; callers retain their data ownership. */
export function NativeContextMenu({
  actions,
  children,
  onAction,
}: {
  actions: readonly MenuAction[]
  children: ReactNode
  onAction: (id: string) => void
}) {
  return (
    <MenuView
      shouldOpenOnLongPress
      actions={[...actions]}
      onOpenMenu={() => haptics.menuOpened()}
      onPressAction={(event) => onAction(event.nativeEvent.event)}
    >
      {children}
    </MenuView>
  )
}
