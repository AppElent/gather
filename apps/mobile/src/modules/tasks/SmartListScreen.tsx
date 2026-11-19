/**
 * One smart list, whole (APP-301): Today, My tasks, Upcoming or Unassigned,
 * across every list of the Current Group.
 *
 * A Wash screen in the Tasks Module's `home` colours with the smart list's
 * glyph on the tile. Upcoming is in days — Overdue, then each day of the next
 * seven that has tasks — and the others are one list, nearest date first.
 * Rows behave exactly as inside a list (`SmartTaskRow`). Linked lists add
 * what they last answered and are never fetched from here (ADR-0021).
 */
import { addDays, localMidnight } from '@gather/core/civil-date'
import {
  type SmartListId,
  upcomingDays,
} from '@gather/core/smart-lists'
import { Stack } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { fmt, type Messages, plural, useI18n } from '../../i18n'
import { SPACE, useTokens } from '../../theme/tokens'
import { InsetList } from '../../ui/inset-list'
import { washScreenOptions } from '../../ui/screen-header'
import { WashHeader } from '../../ui/wash-header'
import { SMART_LIST_GLYPHS } from './icons'
import {
  type SmartDate,
  SmartEmpty,
  SmartHeading,
  SmartTaskRow,
  upperFirst,
} from './smart'
import { useSmartLists } from './store'
import { useTaskSheets } from './taskMenu'
import type { Task } from './types'

export function SmartList({ id }: { id: SmartListId }) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const smart = useSmartLists()
  const taskSheets = useTaskSheets({ tasks: smart.tasks })
  const words = t.tasks.smart.lists[id]
  const tasks = smart.byList[id]
  const listOf = (task: Task) =>
    smart.lists.find((list) => list.id === task.listId)

  const row = (task: Task, date: SmartDate) => (
    <SmartTaskRow
      key={task.id}
      task={task}
      list={listOf(task)}
      today={smart.today}
      date={date}
      onAction={taskSheets.onAction}
    />
  )

  return (
    <>
      <Stack.Screen options={washScreenOptions(words.title)} />
      <ScrollView
        testID={`smart-list-${id}`}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <WashHeader
          group="home"
          glyph={SMART_LIST_GLYPHS[id]}
          summary={{
            count: plural(locale, tasks.length, t.tasks.smart.count),
            scope: lowerFirst(words.subtitle),
          }}
        />
        <View style={styles.content}>
          {!smart.loaded ? null : tasks.length === 0 ? (
            <InsetList>
              <SmartEmpty text={t.tasks.smart.empty[id]} />
            </InsetList>
          ) : id === 'upcoming' ? (
            upcomingDays(tasks, smart.today).map((day) => (
              <View key={day.key} style={styles.section}>
                <SmartHeading
                  label={
                    day.date === null
                      ? t.tasks.smart.days.overdue
                      : dayHeading(day.date, smart.today, locale, t)
                  }
                  aside={day.date === null ? String(day.tasks.length) : undefined}
                  danger={day.date === null}
                />
                <InsetList>
                  {day.tasks.map((task) =>
                    row(task, day.date === null ? 'past' : 'none'),
                  )}
                </InsetList>
              </View>
            ))
          ) : (
            <InsetList>
              {tasks.map((task) => row(task, id === 'today' ? 'late' : 'any'))}
            </InsetList>
          )}
        </View>
      </ScrollView>
      {taskSheets.sheets}
    </>
  )
}

/** "Today · Wednesday 18 November", "Tomorrow · …", or the day itself. */
export function dayHeading(
  date: string,
  today: string,
  locale: string,
  t: Messages,
): string {
  const full = localMidnight(date).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  if (date === today) return fmt(t.tasks.smart.days.today, { date: full })
  if (date === addDays(today, 1)) {
    return fmt(t.tasks.smart.days.tomorrow, { date: full })
  }
  return upperFirst(full)
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase() + text.slice(1)
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[4] },
  section: { gap: SPACE[2] },
})
