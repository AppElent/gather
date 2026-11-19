/**
 * Tasks, level two: one list, whole.
 *
 * Three decisions are load-bearing:
 *
 * - **Rich rows, with a switch.** A row can carry a priority bar, a due date
 *   and its labels. Which of those it draws is a per-list setting in the list's
 *   own ⋯ menu, and with all three off the row collapses to the plain checklist
 *   line. That is what makes "rich vs plain" a setting instead of an argument.
 * - **Reorder is a mode**, reachable from both the row's hold menu and the
 *   list's ⋯ — see `ReorderMode.tsx`.
 * - **A linked list has pull-to-refresh and a sync notice**, because it is
 *   the only kind Convex is not keeping live (ADR-0021). One Gather cannot
 *   write to also says so and hides its composer.
 */

import { type MenuAction, MenuView } from '@expo/ui/community/menu'
import {
  groupBySection,
  hasLinkAndPrice,
  keepsCheckedInPlace,
  taskUrlHost,
} from '@gather/core/task-lists'
import { describeRepeat } from '@gather/core/task-repeat'
import { Stack, useRouter } from 'expo-router'
import { type ReactNode, useRef, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
// Gesture Handler's own ScrollView, not React Native's: reorder's drag names
// this view in `blocksExternalGesture`, and only a scroll view the library
// knows about can be told to stand down for one touch. Gesture Handler 3's
// `ScrollView` does not put a handler tag on its ref, so this is the legacy one
// until reorder moves to the v3 gesture hooks.
import { LegacyScrollView as ScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { confirmDestructive } from '../../feedback/confirmDestructive'
import { haptics } from '../../feedback/haptics'
import { useGroup } from '../../group/GroupProvider'
import { fmt, type Messages, plural, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { CompletedSection } from '../../ui/completed-section'
import { InsetList } from '../../ui/inset-list'
import { moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { useUndoToast } from '../../ui/undo-toast'
import { WashHeader } from '../../ui/wash-header'
import { Chip, priorityColor } from './components'
import { GroceryAmount, useGroceryAmountText } from './GroceryFields'
import { GroceryListBody } from './GroceryListBody'
import { inCheckedSection } from './groceryList'
import { TASK_ICONS, TASK_LIST_GLYPHS } from './icons'
import { AppearanceSheet } from './listFace'
import { PackingProgress, UncheckAll } from './packing'
import { ReorderMode } from './ReorderMode'
import { SectionHeading, SectionsSheet } from './sections'
import { RenameSheet } from './sheets'
import { taskSections, useTaskActions, useTaskList } from './store'
import { TaskComposer, TaskRow } from './TaskRow'
import { dueLabel, isOverdue } from './taskDates'
import { useTaskSheets } from './taskMenu'
import type { ListDisplay, Task, TaskList as TaskListModel } from './types'
import { formatPrice } from './wishlist'

/** A menu entry an owning module adds to the list's ⋯ menu. */
export interface ListMenuExtra {
  id: string
  title: string
  image: MenuAction['image']
  onPress: () => void
}

export function TaskList({
  listId,
  moduleId = 'tasks',
  menuExtras = [],
  addPlaceholder,
  washAccessory,
}: {
  listId: string
  /** The Module whose tile heads the list: Tasks, or the one that owns it. */
  moduleId?: string
  /**
   * What an owning module adds to the list's own menu. Never the back button:
   * the system Back is the one way out of a pushed screen.
   */
  menuExtras?: readonly ListMenuExtra[]
  /** The composer's words, when the list is not a list of tasks. */
  addPlaceholder?: string
  /** Under the wash's summary: the grocery list's store pill (APP-313). */
  washAccessory?: ReactNode
}) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const router = useRouter()
  const { list, tasks, today, refresh } = useTaskList(listId)
  const actions = useTaskActions()
  const amountText = useGroceryAmountText()
  const undoToast = useUndoToast()

  const [renamingList, setRenamingList] = useState(false)
  const [restyling, setRestyling] = useState(false)
  const [editingSections, setEditingSections] = useState(false)
  const [reordering, setReordering] = useState(false)
  const taskSheets = useTaskSheets({
    tasks,
    onReorder: () => setReordering(true),
  })
  const scrollRef = useRef<ScrollView>(null)
  const [dragging, setDragging] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshed, setRefreshed] = useState(false)

  const { active, completed } = taskSections(tasks)

  if (!list) {
    // The only way here is deleting the list from its own screen, which pops.
    return <View style={{ flex: 1, backgroundColor: tokens.ground }} />
  }

  // A packing list keeps its checked items where they are: it is reset for
  // the next trip rather than worked through (APP-306).
  const inPlace = keepsCheckedInPlace(list.kind)
  const listed = inPlace ? tasks : active
  const finished = inPlace ? [] : completed
  const doneCount = tasks.filter((task) => task.done).length
  const wishlist = hasLinkAndPrice(list.kind)
  // A grocery row carries its amount at the end (APP-309), and the list is in
  // aisle sections with Checked and Recent (APP-310).
  const grocery = list.grocery
  const clearable = grocery
    ? tasks.filter((task) => inCheckedSection(task, list.checkedClearedAt))
        .length
    : 0
  // Each section is its own labelled inset list (APP-357), "No section"
  // first; a list without sections is one unlabelled list, as before. A
  // grocery list is in aisle sections instead (APP-310), so it has none.
  const sectioned = !grocery && list.sections.length > 0
  const groups = groupBySection(list.sections, listed)

  // Whether a provider rather than Convex holds the rows. Not `!writable`:
  // being linked and being read-only are separate facts that only coincide
  // while every provider is read-only.
  const linked = list.provider !== 'local'
  const notice = linked ? syncNotice(list, refreshed, t) : null

  const confirmDeleteList = () => {
    confirmDestructive({
      title: fmt(t.tasks.list.deleteTitle, { title: list.name }),
      message: t.tasks.list.deleteBody,
      confirm: t.common.actions.delete,
      cancel: t.common.actions.cancel,
      onConfirm: () => {
        actions.deleteList(list.id)
        router.back()
      },
    })
  }

  const onListMenu = (action: string) => {
    if (action === 'due' || action === 'priority' || action === 'labels') {
      actions.setListDisplay(list, { [action]: !list.display[action] })
      haptics.selectionChanged()
      return
    }
    if (action === 'reorder') setReordering(true)
    if (action === 'rename') setRenamingList(true)
    if (action === 'appearance') setRestyling(true)
    if (action === 'sections') setEditingSections(true)
    if (action === 'delete') confirmDeleteList()
    if (action === 'clear-checked') clearChecked()
    menuExtras.find((extra) => extra.id === action)?.onPress()
  }

  /** Checked items leave the Checked row, stay in Recent, and can come back. */
  const clearChecked = () => {
    const count = clearable
    actions
      .clearChecked(list.id)
      .then((previous) => {
        haptics.itemSaved()
        undoToast.show({
          message: plural(locale, count, t.tasks.grocery.cleared),
          undo: {
            label: t.tasks.grocery.undo,
            onPress: () => {
              void actions
                .restoreCheckedCleared(list.id, previous)
                .catch(() => haptics.actionFailed())
            },
          },
        })
      })
      .catch(() => haptics.actionFailed())
  }

  const onRefresh = async () => {
    setRefreshing(true)
    haptics.refreshStarted()
    const sync = await refresh()
    setRefreshing(false)
    setRefreshed(sync === 'synced')
    if (sync !== 'synced') haptics.actionFailed()
  }

  const openTask = (task: Task) =>
    router.push({
      pathname: '/all/tasks/task/[taskId]',
      params: { taskId: task.id },
    })

  // A local list under Tasks wears its own tile; a list another Module owns
  // (Groceries) wears that Module's, and a linked list the Tasks tile.
  const tile =
    moduleId === 'tasks' && !linked
      ? { group: list.color, glyph: TASK_LIST_GLYPHS[list.icon] }
      : moduleTile(moduleId)

  const row = (task: Task) => (
    <TaskRow
      key={task.id}
      task={task}
      writable={list.writable}
      bar={
        (list.display.priority && priorityColor(task.priority, tokens)) ||
        'transparent'
      }
      meta={
        <TaskMeta
          task={task}
          display={list.display}
          today={today}
          wishlist={wishlist}
          grocery={grocery}
        />
      }
      trailing={grocery ? <GroceryAmount task={task} /> : undefined}
      label={
        grocery
          ? [task.title, amountText(task.quantity, task.unit)]
              .filter(Boolean)
              .join(', ')
          : undefined
      }
      onOpen={() => openTask(task)}
      menu={{
        reorder: true,
        sections: sectioned,
        onAction: (action) => taskSheets.onAction(task, action),
      }}
    />
  )

  return (
    <>
      <Stack.Screen
        options={{
          ...washScreenOptions(list.name),
          headerRight: () =>
            reordering ? (
              <Pressable
                testID="reorder-done"
                accessibilityRole="button"
                accessibilityLabel={t.actions.done}
                hitSlop={12}
                onPress={() => setReordering(false)}
              >
                <Text style={[styles.headerDone, { color: tokens.accentText }]}>
                  {t.actions.done}
                </Text>
              </Pressable>
            ) : (
              <MenuView
                testID="list-menu"
                actions={[
                  {
                    id: 'display',
                    title: t.tasks.list.display,
                    displayInline: true,
                    subactions: [
                      {
                        id: 'due',
                        title: t.tasks.list.dueDates,
                        state: list.display.due ? 'on' : 'off',
                      },
                      {
                        id: 'priority',
                        title: t.tasks.list.priority,
                        state: list.display.priority ? 'on' : 'off',
                      },
                      {
                        id: 'labels',
                        title: t.tasks.list.labels,
                        state: list.display.labels ? 'on' : 'off',
                      },
                    ],
                  },
                  {
                    id: 'reorder',
                    title: t.actions.reorder,
                    image: 'arrow.up.arrow.down',
                    attributes: { disabled: !list.writable },
                  },
                  {
                    id: 'rename',
                    title: t.tasks.list.rename,
                    image: 'pencil',
                    attributes: { disabled: !list.writable },
                  },
                  ...(linked
                    ? []
                    : [
                        {
                          id: 'appearance',
                          title: t.tasks.appearance.title,
                          image: 'paintpalette' as const,
                        },
                        // A grocery list's sections are its aisles.
                        ...(grocery
                          ? []
                          : [
                              {
                                id: 'sections',
                                title: t.tasks.sections.title,
                                image: 'rectangle.split.1x2' as const,
                                attributes: { disabled: !list.writable },
                              },
                            ]),
                      ]),
                  ...(grocery && list.writable
                    ? [
                        {
                          id: 'clear-checked',
                          title: t.tasks.grocery.clearChecked,
                          image: 'checkmark.circle.badge.xmark' as const,
                          attributes: { disabled: clearable === 0 },
                        },
                      ]
                    : []),
                  ...menuExtras.map(({ id, title, image }) => ({
                    id,
                    title,
                    image,
                  })),
                  {
                    id: 'delete',
                    title: t.tasks.list.deleteList,
                    image: 'trash',
                    attributes: { destructive: true },
                  },
                ]}
                onPressAction={(event) => onListMenu(event.nativeEvent.event)}
              >
                <View style={styles.headerButton}>
                  <UI_ICONS.Ellipsis
                    size={22}
                    color={tokens.ink}
                    strokeWidth={2.2}
                  />
                </View>
              </MenuView>
            ),
        }}
      />

      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        keyboardShouldPersistTaps="handled"
        // The composer is the last row: on a small iPhone the keyboard would
        // cover it and a grocery line's recognised chips (APP-309).
        automaticallyAdjustKeyboardInsets
        scrollEnabled={!dragging}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          // Only a provider-backed list has anything to fetch. Convex keeps
          // the rest live, and a spinner over live data is theatre.
          linked ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tokens.muted}
            />
          ) : undefined
        }
      >
        {tile ? (
          <WashHeader
            group={tile.group}
            glyph={tile.glyph}
            summary={{
              count: plural(locale, active.length, t.tasks.count.open),
              scope: group.name,
            }}
            accessory={washAccessory}
          />
        ) : null}
        <View style={styles.content}>
          {reordering ? (
            <ReorderMode
              tasks={listed}
              sections={list.sections}
              display={list.display}
              today={today}
              scrollRef={scrollRef}
              onDragging={setDragging}
              onCommit={(ids, sectionIds) =>
                actions
                  .reorderTasks(list.id, ids, sectionIds)
                  .catch(() => haptics.actionFailed())
              }
            />
          ) : (
            <>
              {notice === null ? null : (
                <View
                  style={[
                    styles.readOnly,
                    {
                      backgroundColor: tokens.surface2,
                      borderColor: tokens.hair,
                    },
                  ]}
                >
                  <TASK_ICONS.Link
                    size={16}
                    color={tokens.muted}
                    strokeWidth={2.2}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text
                    style={[
                      styles.readOnlyText,
                      {
                        color:
                          list.sync === 'reconnect' || list.sync === 'failed'
                            ? tokens.danger
                            : tokens.muted,
                      },
                    ]}
                  >
                    {notice}
                  </Text>
                </View>
              )}

              {inPlace && tasks.length > 0 ? (
                <PackingProgress done={doneCount} total={tasks.length} />
              ) : null}

              {grocery && !inPlace ? (
                <GroceryListBody
                  list={list}
                  tasks={tasks}
                  row={row}
                  empty={
                    <View style={styles.emptyRow}>
                      <Text style={[styles.empty, { color: tokens.muted }]}>
                        {t.tasks.list.empty}
                      </Text>
                    </View>
                  }
                  composer={
                    list.writable ? (
                      <TaskComposer
                        listId={list.id}
                        placeholder={addPlaceholder ?? t.kitchen.addGroceryItem}
                        grocery
                      />
                    ) : null
                  }
                  onUndoable={(message, undo) =>
                    undoToast.show({
                      message,
                      undo: { label: t.tasks.grocery.undo, onPress: undo },
                    })
                  }
                />
              ) : (
                <>
              {groups.map((section, index) => {
                // The last section holds the composer, which adds to it.
                const composer = list.writable && index === groups.length - 1
                return (
                  <View key={section.id ?? 'none'} style={styles.section}>
                    {sectioned ? (
                      <SectionHeading
                        name={section.name ?? t.tasks.sections.none}
                      />
                    ) : null}
                    <InsetList>
                      {!sectioned && tasks.length === 0 ? (
                        <View style={styles.emptyRow}>
                          <Text style={[styles.empty, { color: tokens.muted }]}>
                            {linked && list.sync === 'loading'
                              ? fmt(t.tasks.list.loading, {
                                  provider: list.provider,
                                })
                              : t.tasks.list.empty}
                          </Text>
                        </View>
                      ) : null}
                      {sectioned && section.tasks.length === 0 && !composer ? (
                        <View style={styles.emptyRow}>
                          <Text style={[styles.empty, { color: tokens.muted }]}>
                            {t.tasks.sections.empty}
                          </Text>
                        </View>
                      ) : null}
                      {section.tasks.map(row)}
                      {composer ? (
                        <TaskComposer
                          listId={list.id}
                          placeholder={
                            addPlaceholder ??
                            (grocery
                              ? t.kitchen.addGroceryItem
                              : t.tasks.list.addTask)
                          }
                          grocery={grocery}
                          sectionId={section.id ?? undefined}
                        />
                      ) : null}
                    </InsetList>
                  </View>
                )
              })}

              <CompletedSection
                count={finished.length}
                group="home"
                label={t.common.completed}
              >
                <InsetList>{finished.map(row)}</InsetList>
              </CompletedSection>

                </>
              )}

              {inPlace && list.writable && tasks.length > 0 ? (
                <UncheckAll listId={list.id} doneCount={doneCount} />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {undoToast.toast}
      {taskSheets.sheets}
      {renamingList ? (
        <RenameSheet
          title={t.tasks.list.rename}
          value={list.name}
          onSave={(next) => actions.renameList(list.id, next)}
          onClose={() => setRenamingList(false)}
        />
      ) : null}
      {restyling ? (
        <AppearanceSheet list={list} onClose={() => setRestyling(false)} />
      ) : null}
      {editingSections ? (
        <SectionsSheet list={list} onClose={() => setEditingSections(false)} />
      ) : null}
    </>
  )
}

/**
 * What the banner over a linked list says about where its rows came from, or
 * `null` when there is nothing to say.
 */
function syncNotice(
  list: TaskListModel,
  refreshed: boolean,
  t: Messages,
): string | null {
  const provider = { provider: list.provider }
  if (list.sync === 'reconnect') return fmt(t.tasks.list.reconnect, provider)
  if (list.sync === 'failed') return fmt(t.tasks.list.failed, provider)
  const synced = refreshed && list.sync === 'synced'
  if (list.writable) return synced ? `${t.tasks.list.refreshed}.` : null
  const readOnly = fmt(t.tasks.list.readOnly, provider)
  return synced ? `${readOnly} ${t.tasks.list.refreshed}.` : readOnly
}

/** The due date, priority and labels a list's display settings ask for. */
function TaskMeta({
  task,
  display,
  today,
  wishlist,
  grocery,
}: {
  task: Task
  display: ListDisplay
  today: string
  /** A wishlist row leads with where to buy it and what it costs. */
  wishlist: boolean
  /**
   * A grocery row shows the recipe it is for (APP-312). Its aisle is the
   * heading it sits under (APP-310).
   */
  grocery: boolean
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const buy = wishlist
    ? [
        task.url ? taskUrlHost(task.url) : null,
        task.priceCents === undefined
          ? null
          : formatPrice(task.priceCents, locale),
      ].filter(Boolean)
    : grocery
      ? // The recipe it is for (APP-312), or the first line of a note.
        [task.notes?.trim().split('\n')[0] || null].filter(Boolean)
      : []
  // A repeat is shown whatever the list's settings: it changes what ticking
  // the row does, so it is not an optional detail (APP-303).
  const repeat = task.repeat
    ? describeRepeat(task.repeat, t.tasks.repeat.summary, locale)
    : task.repeatText
  const shown =
    buy.length > 0 ||
    (display.due && task.dueDate) ||
    (display.priority && task.priority) ||
    (display.labels && task.labels.length > 0) ||
    repeat
  if (!shown) return null

  const overdue = Boolean(task.dueDate && isOverdue(task.dueDate, today))
  const flag = priorityColor(task.priority, tokens) ?? tokens.muted

  return (
    <View style={styles.metaRow}>
      {buy.length > 0 ? (
        <Text style={[styles.meta, { color: tokens.muted }]}>
          {buy.join(' \u00b7 ')}
        </Text>
      ) : null}
      {display.due && task.dueDate ? (
        <View style={styles.metaItem}>
          <TASK_ICONS.Calendar
            size={12}
            color={overdue ? tokens.danger : tokens.muted}
            strokeWidth={2.2}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text
            style={[
              styles.meta,
              { color: overdue ? tokens.danger : tokens.muted },
            ]}
          >
            {dueLabel(task.dueDate, today, locale, {
              today: t.tasks.task.today,
              tomorrow: t.tasks.task.tomorrow,
            })}
          </Text>
        </View>
      ) : null}
      {repeat ? (
        <View testID={`repeat-${task.id}`} style={styles.metaItem}>
          <TASK_ICONS.Repeat
            size={12}
            color={tokens.muted}
            strokeWidth={2.2}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[styles.meta, { color: tokens.muted }]}>{repeat}</Text>
        </View>
      ) : null}
      {display.priority && task.priority ? (
        <View style={styles.metaItem}>
          <TASK_ICONS.Flag
            size={12}
            color={flag}
            strokeWidth={2.4}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[styles.meta, { color: flag }]}>
            {t.tasks.task.priorities[task.priority]}
          </Text>
        </View>
      ) : null}
      {display.labels
        ? task.labels.map((label) => <Chip key={label} label={label} />)
        : null}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[4] },
  /** A section's heading sits 8 pt above its inset list (the Tasks study). */
  section: { gap: SPACE[2] },
  headerButton: { paddingHorizontal: 6, paddingVertical: 6 },
  /**
   * A navigation-bar action, dressed the way the platform dresses one: 17pt
   * in the tint colour, semibold because this is the confirming action of a
   * mode. Not `ink` — a bar button that is the same colour as the title does
   * not read as something you can press.
   *
   * iOS 26 draws its own glass capsule around any *custom* header view, which
   * is why this looks like a button rather than bare text; the system reserves
   * plain text for real `UIBarButtonItem`s, and React Navigation's
   * `headerRight` is always a custom view. That is the OS's styling of a
   * native item, not ours to undo.
   */
  headerDone: { ...TYPE.bodyStrong },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
  },
  readOnlyText: { ...TYPE.footnote, flex: 1 },
  emptyRow: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: SPACE[4],
  },
  empty: { ...TYPE.subhead },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { ...TYPE.footnoteStrong },
})
