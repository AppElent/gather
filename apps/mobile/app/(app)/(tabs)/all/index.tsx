/**
 * All: every Gather Module, arranged the way this reader arranged it.
 *
 * The catalogue still decides what exists and which category each Module is in
 * (`@gather/core/modules`); everything else on this screen belongs to the
 * person looking at it — what is pinned to the top, what order the categories
 * come in, what order the Modules come in inside them, what is put away, what
 * is collapsed, and whether any of it is drawn as rows or as tiles. All of it
 * is kept on this phone (ADR-0033), which is also why none of it is a query.
 *
 * Two structural things that are easy to break:
 *
 * - **The `ScrollView` stays the screen's first subview.** The native large
 *   title collapses against it, and `docs/mobile-interaction.md` records that
 *   nesting it one level down silently degrades to `scrollableAxes` — the
 *   screen still looks right and the collapse is simply gone, with no warning.
 *   So Pinned goes *inside* the scroll view, never above it.
 * - **`scrollEnabled` is switched off mid-drag.** `blocksExternalGesture` in
 *   `DragList` is the belt; this is the braces, and the Tasks Module needed
 *   both.
 */
import { router, Stack } from 'expo-router'
import { useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { NativeContextMenu } from '../../../../src/components/NativeContextMenu'
import { useGroup } from '../../../../src/group/GroupProvider'
import { useI18n } from '../../../../src/i18n'
import { moduleDestination } from '../../../../src/modules/moduleDestination'
import {
  HIDDEN_SECTION,
  useAllView,
  useModuleArrangement,
} from '../../../../src/prefs/moduleArrangement'
import { AllEditMode } from '../../../../src/shell/all/AllEditMode'
import {
  type ModuleEntryActions,
  ModuleRow,
  ModuleTile,
} from '../../../../src/shell/all/ModuleEntry'
import { SectionHeader } from '../../../../src/shell/all/SectionHeader'
import { UI_ICONS } from '../../../../src/theme/icons'
import { RADIUS, useTokens } from '../../../../src/theme/tokens'

export default function AllTab() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { group } = useGroup()
  const insets = useSafeAreaInsets()
  const state = useModuleArrangement(group.slug)
  const [view, setView] = useAllView()
  const [editing, setEditing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const { arrangement } = state

  const actionsFor = (id: string): ModuleEntryActions => ({
    isPinned: state.isPinned(id),
    isHidden: arrangement.hidden.some((module) => module.id === id),
    onOpen: () => router.push(moduleDestination(id)),
    onTogglePin: () => state.togglePinned(id),
    onToggleHide: () => state.toggleHide(id),
    onEdit: () => setEditing(true),
  })

  const entries = (modules: typeof arrangement.pinned, key: string) =>
    view === 'grid' ? (
      <View style={styles.tiles}>
        {modules.map((module) => (
          <View key={`${key}-${module.id}`} style={styles.tileSlot}>
            <ModuleTile
              testID={`all-tile-${key}-${module.id}`}
              module={module}
              actions={actionsFor(module.id)}
            />
          </View>
        ))}
        {/* An odd count would stretch the last tile across the row. */}
        {modules.length % 2 === 1 ? <View style={styles.tileSlot} /> : null}
      </View>
    ) : (
      <View style={styles.entries}>
        {modules.map((module) => (
          <ModuleRow
            key={`${key}-${module.id}`}
            testID={`all-row-${key}-${module.id}`}
            module={module}
            actions={actionsFor(module.id)}
          />
        ))}
      </View>
    )

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t.shell.all.title,
          headerRight: () =>
            editing ? (
              <Text
                testID="all-done"
                accessibilityRole="button"
                onPress={() => setEditing(false)}
                style={[styles.done, { color: tokens.accent }]}
              >
                {t.shell.all.done}
              </Text>
            ) : (
              // One control rather than two: View and Edit are both "how this
              // screen is drawn", and iOS puts that behind a single overflow
              // menu (Files, Photos) rather than a row of bar buttons.
              <NativeContextMenu
                trigger="press"
                actions={[
                  {
                    id: 'view',
                    title: t.shell.all.view,
                    displayInline: true,
                    subactions: [
                      {
                        id: 'view-list',
                        title: t.shell.all.viewList,
                        image: 'list.bullet',
                        state: view === 'list' ? 'on' : 'off',
                      },
                      {
                        id: 'view-grid',
                        title: t.shell.all.viewGrid,
                        image: 'square.grid.2x2',
                        state: view === 'grid' ? 'on' : 'off',
                      },
                    ],
                  },
                  {
                    id: 'edit',
                    title: t.shell.all.edit,
                    image: 'arrow.up.arrow.down',
                  },
                ]}
                onAction={(action) => {
                  if (action === 'view-list') setView('list')
                  if (action === 'view-grid') setView('grid')
                  if (action === 'edit') setEditing(true)
                }}
              >
                <View
                  testID="all-options"
                  accessibilityRole="button"
                  accessibilityLabel={t.shell.all.options}
                  hitSlop={12}
                  style={styles.options}
                >
                  {/* Semibold, and no circle of its own - iOS 26 already
                      draws the glass circle around a nav-bar button. */}
                  <UI_ICONS.Ellipsis
                    size={19}
                    color={tokens.accent}
                    strokeWidth={2.2}
                  />
                </View>
              </NativeContextMenu>
            ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        scrollEnabled={!dragging}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 12, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {editing ? (
          <AllEditMode
            state={state}
            scrollRef={scrollRef}
            onDragging={setDragging}
          />
        ) : (
          <>
            <Text style={[styles.intro, { color: tokens.muted }]}>
              {t.shell.all.intro}
            </Text>

            {arrangement.pinned.length > 0 ? (
              <View style={styles.section}>
                {/* Never collapsible: a section whose whole purpose is to be
                    the shortest way to something is not worth folding away. */}
                <SectionHeader
                  testID="all-section-pinned"
                  title={t.shell.all.pinned}
                />
                {entries(arrangement.pinned, 'pinned')}
              </View>
            ) : null}

            {arrangement.groups.map((entry) => {
              if (entry.modules.length === 0) return null
              const collapsed = state.isCollapsed(entry.group)
              return (
                <View key={entry.group} style={styles.section}>
                  <SectionHeader
                    testID={`all-section-${entry.group}`}
                    title={t.modules.groups[entry.group]}
                    collapsed={collapsed}
                    onToggle={() => state.toggleCollapsed(entry.group)}
                  />
                  {collapsed ? null : entries(entry.modules, entry.group)}
                </View>
              )
            })}

            {arrangement.hidden.length > 0 ? (
              <View style={styles.section}>
                {/* Collapsed by default: it is a record of what somebody put
                    away, and it should not cost them the scroll twice. */}
                <SectionHeader
                  testID="all-section-hidden"
                  title={t.shell.all.hiddenCount.replace(
                    '{count}',
                    String(arrangement.hidden.length),
                  )}
                  collapsed={state.isCollapsed(HIDDEN_SECTION)}
                  onToggle={() => state.toggleCollapsed(HIDDEN_SECTION)}
                />
                {state.isCollapsed(HIDDEN_SECTION)
                  ? null
                  : entries(arrangement.hidden, 'hidden')}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 24 },
  intro: { fontSize: 15, lineHeight: 22 },
  section: { gap: 9 },
  entries: { gap: 8 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Two columns without measuring: half the row minus half the gap.
  tileSlot: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row' },
  options: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: RADIUS.control,
  },
  done: { fontSize: 17, fontWeight: '600', paddingHorizontal: 4 },
})
