/**
 * Tasks, level one (direction B, Today-first, APP-301): what is due today,
 * then the other smart lists, then every list in the Group.
 *
 * Three decisions from the canvas are drawn here rather than argued:
 *
 * - **Smart lists are rows, Today is a section.** My tasks, Upcoming and
 *   Unassigned open their own screen; Today is not repeated among them. A
 *   Member hides any of the four from the ⋯ menu, on this phone only.
 * - **Today is a strip, not a list.** Tasks due today come from every list at
 *   once and are tickable where they stand, because "what do I have to do
 *   today" is the question this screen is opened with, and answering it by
 *   making somebody visit four lists is not answering it.
 *
 *   Tickable *where they stand* is not the same as tickable *anywhere on the
 *   row*: the box ticks and the rest of the row opens the task, exactly as a
 *   row inside a list behaves. A row that looks identical one screen down and
 *   answers a tap differently is a trap, and the small target that split
 *   buys back is what `hitSlop` is for.
 * - **A linked list is marked, not filed separately.** Notion and Todoist
 *   lists sit in the same card as local ones with a badge, because where a
 *   list is stored is a property of the list and not a category of list. What
 *   differs is what you may do to it — and that difference belongs on the list
 *   itself (ADR-0021), which is where the next screen puts it.
 */
import { MenuView } from '@expo/ui/community/menu'
import { SMART_LISTS, type SmartListId } from '@gather/core/smart-lists'
import { keepsCheckedInPlace } from '@gather/core/task-lists'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { fmt, type Messages, plural, useI18n } from '../../i18n'
import { useHiddenSmartLists } from '../../prefs/hiddenSmartLists'
import { UI_ICONS } from '../../theme/icons'
import { SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { InsetAddRow, InsetList, InsetRow } from '../../ui/inset-list'
import { ADD_BUTTON_CLEARANCE } from '../../ui/keyboard-composer'
import { ModuleTile, moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { SectionLabel } from '../../ui/section-label'
import { WashHeader } from '../../ui/wash-header'
import { moduleShown } from '../buildModules'
import { AddTask } from './AddTaskComposer'
import { AssigneeCoin, useTaskPeople } from './assignee'
import { SMART_LIST_GLYPHS, TASK_ICONS } from './icons'
import { ListTile } from './listFace'
import { NewListSheet } from './NewListSheet'
import { SmartEmpty, SmartHeading, SmartTaskRow } from './smart'
import { type ListCount, useSmartLists, useTaskIndex } from './store'
import { useTaskSheets } from './taskMenu'
import type { TaskList } from './types'

export function TaskLists() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const router = useRouter()
  // Counts only (APP-430): never a subscription to a list's rows.
  const index = useTaskIndex()
  const tile = moduleTile('tasks')
  const [creating, setCreating] = useState(false)

  const lists = [...index.lists].sort((a, b) => a.order - b.order)

  // The smart lists (APP-301): one subscription for every local list's open
  // rows, plus what the linked lists last answered. Today is the first
  // section rather than a row, because it is what this screen is opened for.
  const smart = useSmartLists()
  // Every row this screen draws is a smart row: the Today strip and the
  // notices below are both read from it, so its sheets need no more.
  const taskSheets = useTaskSheets({ tasks: smart.tasks })
  const { hidden, toggle: toggleHidden } = useHiddenSmartLists()
  const shown = (id: SmartListId) => !hidden.includes(id)
  const due = smart.byList.today
  const late = due.filter(
    (task) => task.dueDate !== undefined && task.dueDate < smart.today,
  ).length
  const smartRows = SMART_LISTS.filter((id) => id !== 'today' && shown(id))
  const smartListOf = (id: string) =>
    smart.lists.find((list) => list.id === id)

  const openTotal = index.openTotal

  // Tasks someone else gave you that you have not opened yet (APP-302): the
  // in-app half of the assignment notice, while push cannot reach the phone.
  // Opening one clears it (`tasks.markAssignmentSeen`). Mine holds every open
  // task assigned to the caller, so the notices are among its rows.
  const { byId } = useTaskPeople()
  const notices = smart.me
    ? smart.tasks
        .filter(
          (task) =>
            !task.done &&
            task.assignmentNotice &&
            task.assigneeId === smart.me,
        )
        .sort(
          (a, b) =>
            (b.assignmentNotice?.at ?? 0) - (a.assignmentNotice?.at ?? 0),
        )
    : []
  const openTask = (taskId: string) =>
    router.push({ pathname: '/all/tasks/task/[taskId]', params: { taskId } })

  return (
    <>
      <Stack.Screen
        options={{
          ...washScreenOptions(t.tasks.title),
          headerRight: () => (
            <MenuView
              testID="tasks-menu"
              actions={[
                {
                  id: 'smart',
                  title: t.tasks.smart.menu,
                  displayInline: true,
                  subactions: SMART_LISTS.map((id) => ({
                    id,
                    title: t.tasks.smart.lists[id].title,
                    state: shown(id) ? ('on' as const) : ('off' as const),
                  })),
                },
              ]}
              onPressAction={(event) => {
                const id = event.nativeEvent.event
                if (SMART_LISTS.some((each) => each === id)) {
                  toggleHidden(id as SmartListId)
                }
              }}
            >
              <View
                style={styles.headerButton}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t.tasks.smart.menu}
              >
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
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 24 + ADD_BUTTON_CLEARANCE,
        }}
      >
        {tile ? (
          <WashHeader
            group={tile.group}
            glyph={tile.glyph}
            summary={{
              count: plural(locale, openTotal, t.tasks.count.open),
              scope: plural(locale, lists.length, t.tasks.count.lists),
            }}
          />
        ) : null}
        <View style={styles.content}>
          {notices.length > 0 ? (
            <View style={styles.group}>
              <SectionLabel>{t.tasks.assignee.notice.title}</SectionLabel>
              <InsetList>
                {notices.map((task) => {
                  const giver = task.assignmentNotice
                    ? byId.get(task.assignmentNotice.by)
                    : undefined
                  const gaveYou = fmt(t.tasks.assignee.notice.gaveYou, {
                    name: giver?.name ?? t.tasks.assignee.someone,
                  })
                  return (
                    <InsetRow
                      key={task.id}
                      testID={`notice-${task.id}`}
                      accessibilityLabel={`${gaveYou}: ${task.title}`}
                      title={task.title}
                      subtitle={gaveYou}
                      leading={<AssigneeCoin initial={giver?.initial ?? '?'} />}
                      chevron
                      onPress={() => openTask(task.id)}
                    />
                  )
                })}
              </InsetList>
            </View>
          ) : null}
          {shown('today') ? (
            <View style={styles.group} testID="smart-today">
              <SmartHeading
                label={t.tasks.smart.lists.today.title}
                aside={
                  late > 0
                    ? fmt(t.tasks.smart.overdueCount, { count: late })
                    : undefined
                }
                danger
              />
              <InsetList>
                {!smart.loaded ? null : due.length === 0 ? (
                  <SmartEmpty text={t.tasks.todayEmpty} />
                ) : (
                  due.map((task) => (
                    <SmartTaskRow
                      key={task.id}
                      task={task}
                      list={smartListOf(task.listId)}
                      today={smart.today}
                      date="late"
                      onAction={taskSheets.onAction}
                    />
                  ))
                )}
              </InsetList>
            </View>
          ) : null}

          {smartRows.length > 0 ? (
            <View style={styles.group}>
              <SectionLabel>{t.tasks.smart.section}</SectionLabel>
              <InsetList>
                {smartRows.map((id) => {
                  const words = t.tasks.smart.lists[id]
                  const count = smart.loaded
                    ? String(smart.byList[id].length)
                    : ''
                  return (
                    <InsetRow
                      key={id}
                      testID={`smart-${id}`}
                      accessibilityLabel={`${words.title}, ${words.subtitle}, ${plural(locale, smart.byList[id].length, t.tasks.smart.count)}`}
                      title={words.title}
                      subtitle={words.subtitle}
                      leading={
                        <ModuleTile
                          group="home"
                          glyph={SMART_LIST_GLYPHS[id]}
                          size="s"
                        />
                      }
                      trailing={
                        <Text style={[styles.count, { color: tokens.muted }]}>
                          {count}
                        </Text>
                      }
                      chevron
                      onPress={() =>
                        router.push({
                          pathname: '/all/tasks/smart/[smartList]',
                          params: { smartList: id },
                        })
                      }
                    />
                  )
                })}
              </InsetList>
            </View>
          ) : null}

          <View style={styles.group}>
            <SectionLabel>{t.tasks.lists}</SectionLabel>
            <InsetList>
              {lists.map((list) => {
                const count = openCount(list, index.counts.get(list.id), t)
                // The type under the name, unless the name already says it.
                const typed =
                  list.provider === 'local' &&
                  list.kind !== 'plain' &&
                  t.tasks.kinds[list.kind].title !== list.name
                return (
                  <InsetRow
                    key={list.id}
                    testID={`list-${list.id}`}
                    accessibilityLabel={
                      typed
                        ? `${list.name}, ${t.tasks.kinds[list.kind].title}, ${count}`
                        : `${list.name}, ${count}`
                    }
                    title={list.name}
                    subtitle={typed ? t.tasks.kinds[list.kind].title : undefined}
                    leading={<ListTile list={list} size="s" />}
                    chevron
                    trailing={
                      <Text style={[styles.count, { color: tokens.muted }]}>
                        {count}
                      </Text>
                    }
                    onPress={() =>
                      router.push({
                        pathname: '/all/tasks/[listId]',
                        params: { listId: list.id },
                      })
                    }
                  >
                    {list.provider === 'local' ? null : (
                      <View style={styles.badge}>
                        <TASK_ICONS.Link
                          size={12}
                          color={tokens.muted}
                          strokeWidth={2.2}
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                        />
                        <Text
                          style={[styles.badgeText, { color: tokens.muted }]}
                        >
                          {t.tasks.linked} · {list.provider}
                        </Text>
                      </View>
                    )}
                  </InsetRow>
                )
              })}
              <InsetAddRow
                group="home"
                label={t.tasks.newList.title}
                onPress={() => setCreating(true)}
                testID="new-list"
              />
            </InsetList>
          </View>
        </View>
      </ScrollView>

      <AddTask place="index" preset={{}} />
      {taskSheets.sheets}
      {creating ? (
        <NewListSheet
          onClose={() => setCreating(false)}
          onCreated={(list) =>
            // A store build that hides Groceries opens the new list itself.
            // Groceries opens the new grocery list, not the last used one.
            list.kind === 'groceries' && moduleShown('groceries')
              ? router.push({
                  pathname: '/all/groceries',
                  params: { listId: list.id },
                })
              : router.push({
                  pathname: '/all/tasks/[listId]',
                  params: { listId: list.id },
                })
          }
        />
      ) : null}
    </>
  )
}

/**
 * How many tasks are left on a list, or that its provider did not answer; ''
 * until the count is known.
 */
function openCount(
  list: TaskList,
  count: ListCount | undefined,
  t: Messages,
): string {
  if (list.sync === 'reconnect' || list.sync === 'failed') {
    return t.tasks.notLoaded
  }
  if (!count) return ''
  // A packing list counts what is packed: its items are ticked off and reset,
  // so "3 left" would read as a list nearly done when it is nearly packed.
  if (keepsCheckedInPlace(list.kind)) {
    return fmt(t.tasks.packing.progress, {
      done: count.done ?? 0,
      total: count.total ?? count.open,
    })
  }
  if (count.open === 0) return t.tasks.allDone
  if (count.open === 1) return t.tasks.openOne
  return fmt(t.tasks.open, { count: count.open })
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[5] },
  group: { gap: SPACE[2] },
  headerButton: { paddingHorizontal: 6, paddingVertical: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { ...TYPE.footnoteStrong },
  count: { ...TYPE.footnote, ...TABULAR },
})
