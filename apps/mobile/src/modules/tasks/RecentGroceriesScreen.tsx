/**
 * Recent (APP-310; `designs/groceries/README.md`, "4. Recent"): what the
 * household checked off its grocery lists, newest first, in days. The plus
 * puts an item back on the list Recent was opened from, with its last amount,
 * unit and aisle; an item already on that list says so instead.
 *
 * Recent is no table of its own: it is the checked items of the Group's
 * grocery lists (`tasks.recentGroceries`).
 */
import { groceryKey, parseGroceryLine } from '@gather/core/groceries'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { haptics } from '../../feedback/haptics'
import { fmt, plural, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { SIZE, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, useInsetSeparator } from '../../ui/inset-list'
import { washScreenOptions } from '../../ui/screen-header'
import { SectionLabel } from '../../ui/section-label'
import { WashHeader } from '../../ui/wash-header'
import { useGroceryAmountText } from './GroceryFields'
import { aisleOf, recentDays, recentWeeks } from './groceryList'
import { useRecentGroceries, useTaskActions, useTaskList } from './store'

type RecentRow = NonNullable<ReturnType<typeof useRecentGroceries>>[number]

/** The key two items share when they are the same thing to buy. */
const keyOf = (title: string) => groceryKey(parseGroceryLine(title).name)

export function RecentGroceries({ listId }: { listId: string }) {
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const r = t.tasks.grocery.recent
  const recent = useRecentGroceries()
  const { tasks } = useTaskList(listId)
  const actions = useTaskActions()
  // Rows put back from here: one put back onto its own list leaves Recent
  // with its check, and would vanish under the finger. It stays, marked as
  // on the list, until the screen closes.
  const [kept, setKept] = useState<ReadonlyMap<string, RecentRow>>(new Map())

  const onList = new Set(
    tasks.filter((task) => !task.done).map((task) => keyOf(task.title)),
  )
  const live = recent ?? []
  const liveIds = new Set(live.map((row) => row._id))
  const rows = [
    ...live,
    ...[...kept.values()].filter((row) => !liveIds.has(row._id)),
  ].sort((a, b) => b.doneAt - a.doneAt)
  const days = recentDays(rows)
  const now = Date.now()

  const putBack = (row: RecentRow) => {
    haptics.itemSaved()
    setKept((current) => new Map(current).set(row._id, row))
    actions.putBack(row._id, listId).catch(() => {
      haptics.actionFailed()
      setKept((current) => {
        const next = new Map(current)
        next.delete(row._id)
        return next
      })
    })
  }

  const today = new Date(now).toDateString()
  const dayLabel = (date: string) => {
    const day = new Date(`${date}T12:00:00`)
    const long = day.toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    if (day.toDateString() === today) return `${r.today} · ${long}`
    return long.charAt(0).toLocaleUpperCase(locale) + long.slice(1)
  }

  return (
    <>
      <Stack.Screen options={washScreenOptions(r.title)} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <WashHeader
          group="kitchen"
          glyph={UI_ICONS.Clock}
          summary={{
            count: plural(locale, rows.length, r.count),
            scope:
              rows.length > 0
                ? plural(locale, recentWeeks(rows, now), r.weeks)
                : undefined,
          }}
        />
        <View style={styles.content}>
          <Text style={[styles.hint, { color: tokens.muted }]}>{r.hint}</Text>
          {recent === undefined ? (
            <LoadingSkeleton label={r.title} />
          ) : rows.length === 0 ? (
            <Text style={[styles.hint, { color: tokens.muted }]}>
              {r.empty}
            </Text>
          ) : (
            days.map((day) => (
              <View key={day.date} style={styles.day}>
                <View accessible accessibilityRole="header">
                  <SectionLabel>{dayLabel(day.date)}</SectionLabel>
                </View>
                <InsetList>
                  {day.rows.map((row) => (
                    <RecentItem
                      key={row._id}
                      row={row}
                      onList={kept.has(row._id) || onList.has(keyOf(row.title))}
                      onPutBack={() => putBack(row)}
                    />
                  ))}
                </InsetList>
              </View>
            ))
          )}
          {rows.length > 0 ? (
            <Text style={[styles.footnote, { color: tokens.muted }]}>
              {r.footnote}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </>
  )
}

function RecentItem({
  row,
  onList,
  onPutBack,
}: {
  row: RecentRow
  onList: boolean
  onPutBack: () => void
}) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const g = t.tasks.grocery
  const separator = useInsetSeparator()
  const amountText = useGroceryAmountText()
  const amount = amountText(row.quantity, row.unit)
  const aisle = g.aisles[aisleOf(row)]
  const meta = amount ? `${fmt(g.recent.last, { amount })} · ${aisle}` : aisle

  return (
    <View
      testID={`recent-${row._id}`}
      style={[styles.row, separator, { backgroundColor: tokens.surface }]}
    >
      <View
        accessible
        accessibilityLabel={`${row.title}, ${meta}`}
        style={styles.text}
      >
        <Text style={[styles.name, { color: tokens.ink }]}>{row.title}</Text>
        <Text style={[styles.meta, { color: tokens.muted }]}>{meta}</Text>
      </View>
      {onList ? (
        <View
          accessible
          accessibilityLabel={g.recent.onList}
          style={styles.onList}
          testID={`recent-on-list-${row._id}`}
        >
          <UI_ICONS.Check
            size={15}
            color={tokens.muted}
            strokeWidth={2.4}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={[styles.onListLabel, { color: tokens.muted }]}>
            {g.recent.onList}
          </Text>
        </View>
      ) : (
        <Pressable
          testID={`recent-add-${row._id}`}
          accessibilityRole="button"
          accessibilityLabel={fmt(g.recent.putBack, { name: row.title })}
          onPress={onPutBack}
          style={({ pressed }) => [
            styles.add,
            { backgroundColor: tokens.surface2 },
            pressed && styles.pressed,
          ]}
        >
          <UI_ICONS.Plus
            size={20}
            color={tokens.ink}
            strokeWidth={2.4}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[4] },
  hint: { ...TYPE.subhead },
  day: { gap: SPACE[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    minHeight: 56,
    paddingLeft: SPACE[4],
    paddingRight: SPACE[2],
    paddingVertical: 6,
  },
  text: { flex: 1, minWidth: 0 },
  name: { ...TYPE.body },
  meta: { ...TYPE.footnote },
  onList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: SIZE.hitMin,
    paddingHorizontal: SPACE[2],
  },
  onListLabel: { ...TYPE.subhead },
  add: {
    width: SIZE.hitMin,
    height: SIZE.hitMin,
    borderRadius: SIZE.hitMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.94 }] },
  footnote: { ...TYPE.footnote, paddingHorizontal: SPACE[1] },
})
