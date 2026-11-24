import { type MenuAction, MenuView } from '@expo/ui/community/menu'
import { type ReactNode, useState } from 'react'
import {
  type StyleProp,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native'

import { haptics } from '../feedback/haptics'

/**
 * Platform menu with UI-only actions; callers retain their data ownership.
 *
 * **Hold is the default and stays the default** (`apps/mobile/DESIGN_SYSTEM.md`):
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
 *
 * **The host is re-measured when its slot or the text size changes.** It keeps
 * the size it measured on mount, so the menu is remounted whenever the
 * measured slot width changes (a rotation, a split view), and after a font
 * scale change (Dynamic Type) the slot is measured afresh before the menu
 * mounts again, so the row follows its slot. A change to the
 * content alone that leaves both unchanged — a new label in a slot that is
 * only as wide as its content — is not seen; a caller whose content sizes the
 * slot passes a `key` that changes with that content.
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
  const { fontScale } = useWindowDimensions()
  // The width belongs to the font scale it was measured at: after a text-size
  // change the old width is a stale one and is not handed down again.
  const [measured, setMeasured] = useState<{ width: number; fontScale: number }>()
  const width = measured?.fontScale === fontScale ? measured.width : undefined
  const menu = (
    content: ReactNode,
    menuStyle?: StyleProp<ViewStyle>,
    menuKey?: string,
  ) => (
    <MenuView
      key={menuKey}
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
      // Remounting the slot makes it report its width again.
      key={fontScale}
      style={[{ alignSelf: 'stretch' }, style]}
      onLayout={(event) =>
        setMeasured({ width: event.nativeEvent.layout.width, fontScale })
      }
    >
      {/* The host keeps the size it measured on mount, so it only mounts once
          there is a width to give it (the first frame is the bare row) and
          remounts when the width or the text size changes. */}
      {width == null
        ? children
        : menu(
            <View style={{ width }}>{children}</View>,
            undefined,
            String(width),
          )}
    </View>
  )
}
