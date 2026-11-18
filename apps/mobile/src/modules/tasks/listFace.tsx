/**
 * A list's face (APP-306): its tile, and the two pickers that choose it.
 *
 * The colour is one of the four group fills and appears only on the list's
 * own tile — its row on the index, its `WashHeader`, the New list preview —
 * never on rows or text (`apps/mobile/DESIGN_SYSTEM.md`). A linked list wears
 * no colour: its tile is `surface-2` with the link glyph, because where it
 * lives is what the tile says about it.
 */
import {
  iconChoices,
  TASK_LIST_COLORS,
  type TaskListColor,
  type TaskListIcon,
} from '@gather/core/task-lists'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { NativeSheet } from '../../components/NativeSheet'
import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { RADIUS, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { ModuleTile, TILE_METRICS, type TileSize } from '../../ui/module-tile'
import { TASK_ICONS, TASK_LIST_GLYPHS } from './icons'
import { useTaskActions } from './store'
import type { TaskList } from './types'

/** A list's tile at one of the tile sizes. */
export function ListTile({
  list,
  size,
}: {
  list: Pick<TaskList, 'provider' | 'icon' | 'color'>
  size: TileSize
}) {
  const tokens = useTokens()
  if (list.provider === 'local') {
    return (
      <ModuleTile
        group={list.color}
        glyph={TASK_LIST_GLYPHS[list.icon]}
        size={size}
      />
    )
  }
  const metrics = TILE_METRICS[size]
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          width: metrics.box,
          height: metrics.box,
          borderRadius: metrics.radius,
          backgroundColor: tokens.surface2,
        },
      ]}
    >
      <TASK_ICONS.Link size={metrics.glyph} color={tokens.ink} />
    </View>
  )
}

/** Four swatches, one chosen: a ring in `ink` with a `surface` gap. */
export function ColorSwatches({
  value,
  onChange,
}: {
  value: TaskListColor
  onChange: (color: TaskListColor) => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t.tasks.newList.color}
      style={styles.choices}
    >
      {TASK_LIST_COLORS.map((color) => {
        const selected = color === value
        return (
          <Pressable
            key={color}
            testID={`list-color-${color}`}
            accessibilityRole="radio"
            accessibilityLabel={t.tasks.colors[color]}
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (!selected) haptics.selectionChanged()
              onChange(color)
            }}
            style={styles.swatchTarget}
          >
            <View
              style={[
                styles.ring,
                { borderColor: selected ? tokens.ink : 'transparent' },
              ]}
            >
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: tokens.tintOf(color).fill },
                ]}
              />
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

/** The icon row: the chosen one is an `ink` disc with an `onInk` glyph. */
export function IconChoices({
  icons,
  value,
  onChange,
  firstLabel,
}: {
  icons: readonly TaskListIcon[]
  value: TaskListIcon
  onChange: (icon: TaskListIcon) => void
  /** Read out on the first icon instead of its name: "Icon of the type". */
  firstLabel?: string
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t.tasks.newList.icon}
      style={styles.icons}
    >
      {icons.map((icon, index) => {
        const selected = icon === value
        const Glyph = TASK_LIST_GLYPHS[icon]
        return (
          <Pressable
            key={icon}
            testID={`list-icon-${icon}`}
            accessibilityRole="radio"
            accessibilityLabel={
              index === 0 && firstLabel
                ? `${firstLabel}, ${t.tasks.icons[icon]}`
                : t.tasks.icons[icon]
            }
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (!selected) haptics.selectionChanged()
              onChange(icon)
            }}
            style={styles.iconTarget}
          >
            <View
              style={[
                styles.iconDisc,
                { backgroundColor: selected ? tokens.ink : tokens.surface2 },
              ]}
            >
              <Glyph
                size={18}
                color={selected ? tokens.onInk : tokens.ink}
                strokeWidth={2}
              />
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * Colour and icon, from the list's ⋯ menu. Like the task property sheets it
 * has no Save: each pick is written as it is made, and the tile at the top
 * shows it.
 */
export function AppearanceSheet({
  list,
  onClose,
}: {
  list: TaskList
  onClose: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const actions = useTaskActions()
  const offered = iconChoices(list.kind)
  // An icon picked under another kind stays on offer rather than vanishing.
  const icons = offered.includes(list.icon)
    ? offered
    : [...offered.slice(0, -1), list.icon]
  const write = (face: { icon?: TaskListIcon; color?: TaskListColor }) =>
    actions.setListAppearance(list.id, face).catch(() => haptics.actionFailed())

  return (
    <NativeSheet
      title={t.tasks.appearance.title}
      subtitle={list.name}
      leading={<ListTile list={list} size="m" />}
      onClose={onClose}
    >
      <View style={[styles.sheetRow, { borderBottomColor: tokens.hair }]}>
        <Text style={[styles.sheetLabel, { color: tokens.ink }]}>
          {t.tasks.newList.color}
        </Text>
        <ColorSwatches
          value={list.color}
          onChange={(color) => write({ color })}
        />
      </View>
      <View style={styles.sheetRow}>
        <Text style={[styles.sheetLabel, { color: tokens.ink }]}>
          {t.tasks.newList.icon}
        </Text>
        <IconChoices
          icons={icons}
          value={list.icon}
          onChange={(icon) => write({ icon })}
          firstLabel={t.tasks.newList.kindIcon}
        />
      </View>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: SPACE[1],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  sheetLabel: { ...TYPE.body, flex: 1 },
  tile: {
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choices: { flexDirection: 'row', gap: 6 },
  swatchTarget: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 28, height: 28, borderRadius: RADIUS.pill },
  icons: { flexDirection: 'row', gap: 2 },
  iconTarget: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDisc: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
