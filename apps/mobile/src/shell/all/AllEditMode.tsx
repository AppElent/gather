/**
 * Arranging the All screen, as a mode.
 *
 * `docs/mobile-interaction.md` settles the shape: rearranging is a mode rather
 * than a gesture, because hold means "open the menu" everywhere in this app and
 * a hold that sometimes became a drag would claim the gesture before anybody
 * knew it was one. So this is reached from that menu, or from the one in the
 * nav bar, and Done in the nav bar is the way out.
 *
 * Three decisions that are not obvious from looking at it:
 *
 * - **Always a list, whatever the screen is set to draw.** Dragging in a
 *   two-column grid is two-dimensional arithmetic and `arrange/arrange.ts` is
 *   one-dimensional. iOS does the same thing - Photos' own Customize screen is
 *   a list even though the screen it customises is a grid.
 * - **Categories are their own compact list**, rather than grips on the
 *   section headings. A section is as tall as whatever is inside it, and the
 *   drop arithmetic divides by a fixed row height; four names at 56pt each is
 *   a list that can actually be dragged.
 * - **Every section is expanded here**, whatever the reader had collapsed.
 *   Nobody can drag a row into a section they cannot see. The screen puts the
 *   collapse state back on Done.
 */
import type { ModuleGroup } from '@gather/core/modules'
import { moduleText } from '@gather/core/modules'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ScrollView as GestureScrollView } from 'react-native-gesture-handler'

import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import type { ModuleArrangement } from '../../prefs/moduleArrangement'
import { MODULE_ICONS, UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { type DragItem, DragList } from './DragList'
import { SectionHeader } from './SectionHeader'

export function AllEditMode({
  state,
  scrollRef,
  onDragging,
}: {
  state: ModuleArrangement
  scrollRef: React.RefObject<GestureScrollView | null>
  onDragging: (dragging: boolean) => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  const { arrangement } = state

  const moduleItems = (group: ModuleGroup): DragItem[] => {
    const tint = tokens.tintOf(group)
    return (
      arrangement.groups.find((entry) => entry.group === group)?.modules ?? []
    ).map((module) => ({
      id: module.id,
      label: moduleText(module, t).label,
      icon: MODULE_ICONS[module.icon],
      iconColor: tint.fg,
    }))
  }

  const dragModule = (label: string) =>
    t.shell.all.dragModule.replace('{module}', label)

  /** Takes a Module out of the screen, or a Pin off the top. */
  const roundButton = (
    kind: 'remove' | 'add',
    label: string,
    onPress: () => void,
    testID: string,
  ) => {
    const Icon = kind === 'remove' ? UI_ICONS.CircleMinus : UI_ICONS.CirclePlus
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={12}
        onPress={() => {
          onPress()
          haptics.itemSaved()
        }}
      >
        <Icon
          size={22}
          color={kind === 'remove' ? tokens.danger : tokens.accent}
          strokeWidth={1.9}
        />
      </Pressable>
    )
  }

  return (
    <>
      <View style={[styles.hint, { backgroundColor: tokens.tile }]}>
        <UI_ICONS.GripVertical
          size={17}
          color={tokens.muted}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={[styles.hintText, { color: tokens.muted }]}>
          {t.shell.all.reorderHint}
        </Text>
      </View>

      {arrangement.pinned.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title={t.shell.all.pinned} />
          <DragList
            testID="all-edit-pinned"
            items={arrangement.pinned.map((module) => ({
              id: module.id,
              label: moduleText(module, t).label,
              icon: MODULE_ICONS[module.icon],
              iconColor: tokens.tintOf(module.group).fg,
            }))}
            scrollRef={scrollRef}
            onDragging={onDragging}
            onCommit={state.setPinnedOrder}
            dragLabel={dragModule}
            trailing={(item) =>
              roundButton(
                'remove',
                t.shell.all.unpinModule.replace('{module}', item.label),
                () => state.togglePinned(item.id),
                `all-unpin-${item.id}`,
              )
            }
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title={t.shell.all.categories} />
        <DragList
          testID="all-edit-groups"
          items={arrangement.groups.map((entry) => ({
            id: entry.group,
            label: t.modules.groups[entry.group],
          }))}
          scrollRef={scrollRef}
          onDragging={onDragging}
          onCommit={(ids) => state.setGroupOrder(ids as ModuleGroup[])}
          dragLabel={(label) =>
            t.shell.all.dragSection.replace('{section}', label)
          }
        />
      </View>

      {arrangement.groups.map((entry) => {
        const items = moduleItems(entry.group)
        if (items.length === 0) return null
        return (
          <View key={entry.group} style={styles.section}>
            <SectionHeader title={t.modules.groups[entry.group]} />
            <DragList
              testID={`all-edit-group-${entry.group}`}
              items={items}
              scrollRef={scrollRef}
              onDragging={onDragging}
              onCommit={(ids) => state.setModuleOrder(entry.group, ids)}
              dragLabel={dragModule}
              trailing={(item) =>
                roundButton(
                  'remove',
                  t.shell.all.hideModule.replace('{module}', item.label),
                  () => state.toggleHide(item.id),
                  `all-hide-${item.id}`,
                )
              }
            />
          </View>
        )
      })}

      {arrangement.hidden.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title={t.shell.all.hidden} />
          {/* Not a `DragList`: the hidden list has no order worth keeping, and
              a grip on a row whose position means nothing is a lie. */}
          <View
            testID="all-edit-hidden"
            style={[
              styles.card,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
            ]}
          >
            {arrangement.hidden.map((module, index) => {
              const label = moduleText(module, t).label
              const Icon = MODULE_ICONS[module.icon]
              return (
                <View
                  key={module.id}
                  testID={`all-hidden-${module.id}`}
                  style={[
                    styles.hiddenRow,
                    {
                      borderBottomColor: tokens.border,
                      borderBottomWidth:
                        index === arrangement.hidden.length - 1
                          ? 0
                          : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Icon
                    size={20}
                    color={tokens.tintOf(module.group).fg}
                    strokeWidth={1.75}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.hiddenLabel, { color: tokens.fg }]}
                  >
                    {label}
                  </Text>
                  {roundButton(
                    'add',
                    t.shell.all.showModule.replace('{module}', label),
                    () => state.toggleHide(module.id),
                    `all-show-${module.id}`,
                  )}
                </View>
              )
            })}
          </View>
        </View>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  section: { gap: 9 },
  hint: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    padding: 11,
    borderRadius: RADIUS.control,
  },
  hintText: { flex: 1, fontSize: 13, lineHeight: 19 },
  card: {
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  hiddenRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  hiddenLabel: { flex: 1, fontSize: 15.5 },
})
