import { type MenuAction, MenuView } from '@expo/ui/community/menu'
import { type ReactNode, useState } from 'react'
import { type StyleProp, View, type ViewStyle } from 'react-native'

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
 * **The row is as wide as the slot it sits in, not as wide as its text.** On
 * iOS the menu is a SwiftUI host that sizes itself to its React Native
 * children (`matchContents`), and those children have nothing wider to stretch
 * against — so a row wrapped in a menu came out exactly as wide as its label.
 * The outer view below takes the slot's width (stretched in a column, `style`
 * in a row) and hands that measured width down to the children, mounting the
 * menu only once it is known. Anything laid
 * out along a row still passes `{ flex: 1 }` through `style`.
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
  const [width, setWidth] = useState<number>()
  const menu = (content: ReactNode, menuStyle?: StyleProp<ViewStyle>) => (
    <MenuView
      style={menuStyle}
      shouldOpenOnLongPress={trigger === 'hold'}
      actions={[...actions]}
      onOpenMenu={() => haptics.menuOpened()}
      onPressAction={(event) => onAction(event.nativeEvent.event)}
    >
      {content}
    </MenuView>
  )
  // A button in a navigation bar keeps its own size.
  if (trigger === 'press') return menu(children, style)
  return (
    <View
      style={[{ alignSelf: 'stretch' }, style]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {/* The host keeps the size it measured on mount, so it only mounts once
          there is a width to give it; the first frame is the bare row. */}
      {width == null
        ? children
        : menu(<View style={{ width }}>{children}</View>)}
    </View>
  )
}
