/**
 * One Module, as a row or as a tile, with the menu that hold opens on it.
 *
 * Both shapes exist because the All screen can be drawn either way and the
 * choice is the reader's. What does *not* change between them is everything
 * that matters: the same glyph tile, the same hold menu, the same accessible
 * name. The tile is the only part in the group's colour; the row or card around
 * it stays neutral (ADR-0017).
 * A tile drops the description because there is nowhere for it to go at that
 * width, and a truncated sentence is worse than no sentence.
 *
 * Both also carry a Pin in the top right corner. The hold menu can pin too, and
 * so can Edit mode, but a menu is never the only way to reach something
 * (`apps/mobile/DESIGN_SYSTEM.md`) - and pinning is the one thing on this screen
 * somebody does often enough to want a target rather than a gesture.
 *
 * **The Pin is a sibling of the row, not a child of it**, which is the one
 * thing here that is not obvious and cannot be simplified away. Two reasons,
 * either of which is enough: a `Pressable` inside a `Pressable` has to win a
 * responder negotiation it does not reliably win, and on iOS `MenuView` hosts
 * its trigger inside a SwiftUI `Host`, so anything in there is behind a hosting
 * boundary rather than beside the row in the view hierarchy. Nested, the Pin
 * swallowed nothing and the Module simply opened. Overlaid, it is an ordinary
 * sibling painted after - and above - the row, and UIKit hit-tests it first.
 */
import type { ModuleDef } from '@gather/core/modules'
import { moduleText } from '@gather/core/modules'
import type { ReactNode } from 'react'
import {
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'

import { NativeContextMenu } from '../../components/NativeContextMenu'
import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { MODULE_ICONS, UI_ICONS } from '../../theme/icons'
import { RADIUS, SIZE, TYPE, useTokens } from '../../theme/tokens'

export interface ModuleEntryActions {
  isPinned: boolean
  isHidden: boolean
  onOpen: () => void
  onTogglePin: () => void
  onToggleHide: () => void
  onEdit: () => void
}

/**
 * Feedback that is a fill rather than a fade.
 *
 * `apps/mobile/DESIGN_SYSTEM.md` bans `opacity: 0.6` by name - it is the React
 * Native default and it is wrong on both platforms, because it dims the *row*
 * where the platform lightens the *surface behind* it. So Android gets its own
 * ripple and iOS gets the quiet `surface2` fill, which reads as the row
 * highlighting rather than the row fading out.
 */
const IOS = Platform.OS === 'ios'

function fillStyle(pressed: boolean, quiet: string) {
  return pressed && IOS ? { backgroundColor: quiet } : null
}

/** The Pin's only visible name, so it says which Module it would pin. */
function pinLabel(
  t: ReturnType<typeof useI18n>['t'],
  pinned: boolean,
  label: string,
) {
  const template = pinned ? t.shell.all.unpinModule : t.shell.all.pinModule
  return template.replace('{module}', label)
}

/**
 * The Pin, as a target rather than a menu item.
 *
 * Filled in ink when it is pinned and a muted outline when it is not, because
 * an outline alone reads as a button that does nothing. Never the group's
 * colour: it is a glyph outside a tile. A hidden Module gets no
 * Pin at all: a shortcut to something deliberately out of sight is a
 * contradiction, and `arrangeModules` would drop it on the next read anyway.
 */
function PinButton({
  actions,
  label,
  testID,
}: {
  actions: ModuleEntryActions
  label: string
  testID: string
}) {
  const tokens = useTokens()
  if (actions.isHidden) return null
  const Icon = actions.isPinned ? UI_ICONS.PinFill : UI_ICONS.Pin
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={14}
      onPress={() => {
        actions.onTogglePin()
        haptics.itemSaved()
      }}
      style={styles.pin}
    >
      <Icon
        size={17}
        color={actions.isPinned ? tokens.ink : tokens.muted}
        fill={actions.isPinned ? tokens.ink : undefined}
        strokeWidth={1.9}
      />
    </Pressable>
  )
}

function ModuleMenu({
  actions,
  children,
  style,
}: {
  actions: ModuleEntryActions
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const { t } = useI18n()
  return (
    <NativeContextMenu
      style={style}
      actions={[
        {
          id: 'pin',
          title: actions.isPinned ? t.shell.all.unpin : t.shell.all.pin,
          image: actions.isPinned ? 'pin.slash' : 'pin',
        },
        {
          id: 'hide',
          title: actions.isHidden ? t.shell.all.show : t.shell.all.hide,
          image: actions.isHidden ? 'eye' : 'eye.slash',
        },
        { id: 'edit', title: t.shell.all.edit, image: 'arrow.up.arrow.down' },
      ]}
      onAction={(action) => {
        if (action === 'pin') actions.onTogglePin()
        if (action === 'hide') actions.onToggleHide()
        if (action === 'edit') actions.onEdit()
      }}
    >
      {children}
    </NativeContextMenu>
  )
}

export function ModuleRow({
  module,
  actions,
  testID,
}: {
  module: ModuleDef
  actions: ModuleEntryActions
  testID?: string
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const tint = tokens.tintOf(module.group)
  const text = moduleText(module, t)
  const Icon = MODULE_ICONS[module.icon]
  const id = testID ?? `all-row-${module.id}`

  return (
    <View>
      <ModuleMenu actions={actions}>
        <Pressable
          testID={id}
          accessibilityRole="button"
          accessibilityLabel={text.label}
          onPress={actions.onOpen}
          android_ripple={{ color: tokens.hair }}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: tokens.surface },
            fillStyle(pressed, tokens.surface2),
          ]}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.rowGlyph, { backgroundColor: tint.fill }]}
          >
            <Icon size={16} color={tint.on} strokeWidth={1.9} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: tokens.ink }]}>
              {text.label}
            </Text>
            <Text style={[styles.rowDescription, { color: tokens.muted }]}>
              {text.description}
            </Text>
          </View>
        </Pressable>
      </ModuleMenu>
      <PinButton
        actions={actions}
        label={pinLabel(t, actions.isPinned, text.label)}
        testID={`${id}-pin`}
      />
    </View>
  )
}

export function ModuleTile({
  module,
  actions,
  testID,
}: {
  module: ModuleDef
  actions: ModuleEntryActions
  /**
   * Overridden by the caller because a pinned Module is drawn twice - once at
   * the top and once in its own category - and two views with one
   * `resource-id` make an `id` selector ambiguous rather than wrong, which is
   * the harder kind of test failure to read.
   */
  testID?: string
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const tint = tokens.tintOf(module.group)
  const text = moduleText(module, t)
  const Icon = MODULE_ICONS[module.icon]
  const id = testID ?? `all-tile-${module.id}`

  return (
    <View style={styles.tileEntry}>
      {/* `flex: 1` on the menu, not only on the tile inside it: the trigger
          wrapper is a view of its own, and without it the tile is as tall as
          its label rather than as tall as the row it shares. */}
      <ModuleMenu actions={actions} style={styles.tileMenu}>
        <Pressable
          testID={id}
          accessibilityRole="button"
          accessibilityLabel={text.label}
          onPress={actions.onOpen}
          android_ripple={{ color: tokens.hair }}
          style={({ pressed }) => [
            styles.tile,
            { backgroundColor: tokens.surface },
            fillStyle(pressed, tokens.surface2),
          ]}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.tileGlyph, { backgroundColor: tint.fill }]}
          >
            <Icon size={20} color={tint.on} strokeWidth={1.9} />
          </View>
          <Text
            // Two lines rather than one: "Meal planner" and "Baby log" wrap at
            // Dynamic Type XL, and a clipped Module name is not a Module name.
            numberOfLines={2}
            style={[styles.tileTitle, { color: tokens.ink }]}
          >
            {text.label}
          </Text>
        </Pressable>
      </ModuleMenu>
      <PinButton
        actions={actions}
        label={pinLabel(t, actions.isPinned, text.label)}
        testID={`${id}-pin`}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: RADIUS.card,
    padding: 14,
    // Room for the Pin overlaying the corner, so a long description never
    // runs underneath it.
    paddingRight: 36,
    overflow: 'hidden',
  },
  rowGlyph: {
    width: SIZE.tileS,
    height: SIZE.tileS,
    borderRadius: RADIUS.tileS,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...TYPE.bodyStrong },
  rowDescription: { ...TYPE.subhead },
  // Above the row it sits on, in both senses: painted last, and raised on
  // Android where paint order alone does not decide who is touched.
  pin: { position: 'absolute', top: 8, right: 8, padding: 5, zIndex: 2 },
  tileEntry: { flex: 1 },
  tileMenu: { flex: 1 },
  tile: {
    flex: 1,
    minHeight: 96,
    gap: 10,
    borderRadius: RADIUS.card,
    padding: 14,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  tileGlyph: {
    width: SIZE.tileM,
    height: SIZE.tileM,
    borderRadius: RADIUS.tileM,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { ...TYPE.bodyStrong },
})
