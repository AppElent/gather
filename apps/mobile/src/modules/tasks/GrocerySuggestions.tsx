/**
 * What the household usually buys, on a grocery list (APP-311;
 * `designs/groceries/README.md`, section 1 item 2 and section 2):
 *
 * - the "Maybe needed" strip above the aisles: up to eight names the server
 *   says are due (`tasks.groceryHabits`). A tap adds the name with its usual
 *   amount; press and hold opens its menu with Hide, which hides it for good
 *   (with Undo). Hidden when empty, switched off, or read-only.
 * - the composer's autocomplete: what is typed, completed from the Group's
 *   history first, then from the bundled names (`groceryCompletions`), the
 *   typed part in 600. A tap adds that name; a name already open on the list
 *   is never added beside it: a typed amount that adds up is added to it
 *   (trailing `+2 pak`), anything else leaves it as it is (APP-427).
 */
import {
  addGroceryAmounts,
  capitalise,
  daysAgo,
  type GroceryCompletion,
  type GroceryHabit,
  groceryCadence,
  groceryCompletions,
  groceryKey,
  groceryNames,
  parseGroceryLine,
  typedSpan,
} from '@gather/core/groceries'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { NativeContextMenu } from '../../components/NativeContextMenu'
import { haptics } from '../../feedback/haptics'
import { fmt, plural, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SIZE, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { useGroceryAmountText } from './GroceryFields'
import { useGroceryHabits, useTaskActions } from './store'
import type { Task, TaskList } from './types'

/** A card's width in the strip (the design's 148 pt). */
const CARD_WIDTH = 148

/** "every 4 days", "every week": a usual interval in words. */
function useCadenceText() {
  const { t } = useI18n()
  const words = t.tasks.grocery.suggestions.cadence
  return (intervalDays: number) => {
    const cadence = groceryCadence(intervalDays)
    return 'count' in cadence
      ? fmt(words[cadence.unit], { count: cadence.count })
      : words[cadence.unit]
  }
}

/** A card's footnote: "Every week · 8 days ago". */
function useWhyText() {
  const { t, locale } = useI18n()
  const s = t.tasks.grocery.suggestions
  const cadenceText = useCadenceText()
  return (habit: GroceryHabit, now: number) => {
    const days = daysAgo(habit.lastAt, now)
    const ago =
      days === 0
        ? s.ago.today
        : days === 1
          ? s.ago.yesterday
          : plural(locale, days, s.ago.days)
    // A number stays on the line of its unit: "5 days ago", never "5" and
    // then "days ago" in a narrow card.
    return capitalise(
      fmt(s.why, {
        cadence: cadenceText(habit.intervalDays ?? 1),
        ago,
      }),
    ).replace(/(\d) /g, '$1 ')
  }
}

export function SuggestionStrip({
  list,
  onUndoable,
}: {
  list: TaskList
  /** Shows a message with Undo, outside the scroll view. */
  onUndoable: (message: string, undo: () => void) => void
}) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const s = t.tasks.grocery.suggestions
  const actions = useTaskActions()
  const habits = useGroceryHabits(list.id)
  const whyText = useWhyText()
  // Names tapped or hidden here leave the strip at once; the server's
  // answer then leaves them out for good.
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set())
  // Once the server leaves a name out, the local hold on it is let go: if
  // the added item is then deleted unbought, the name can come back.
  const served = habits?.suggestions
  useEffect(() => {
    if (!served) return
    const keys = new Set(served.map((habit) => habit.key))
    setGone((held) => {
      const kept = [...held].filter((key) => keys.has(key))
      return kept.length === held.size ? held : new Set(kept)
    })
  }, [served])

  if (!list.writable || list.suggestionsOff) return null
  const now = Date.now()
  const shown = (habits?.suggestions ?? []).filter((h) => !gone.has(h.key))
  if (shown.length === 0) return null

  const leave = (key: string, leaving: boolean) =>
    setGone((keys) => {
      const next = new Set(keys)
      if (leaving) next.add(key)
      else next.delete(key)
      return next
    })

  const add = (habit: GroceryHabit) => {
    leave(habit.key, true)
    actions
      .addGrocery(list.id, {
        title: habit.title,
        quantity: habit.quantity,
        unit: habit.unit,
      })
      .then(
        () => haptics.itemSaved(),
        () => {
          leave(habit.key, false)
          haptics.actionFailed()
        },
      )
  }

  const hide = (habit: GroceryHabit) => {
    leave(habit.key, true)
    actions.hideSuggestion(list.id, habit.title).then(
      () =>
        onUndoable(fmt(s.hidden, { name: habit.title }), () => {
          leave(habit.key, false)
          void actions
            .unhideSuggestion(list.id, habit.title)
            .catch(() => haptics.actionFailed())
        }),
      () => {
        leave(habit.key, false)
        haptics.actionFailed()
      },
    )
  }

  return (
    <View style={styles.section} testID="grocery-suggestions">
      <View style={styles.head}>
        <Text
          accessibilityRole="header"
          style={[styles.label, { color: tokens.muted }]}
        >
          {s.title}
        </Text>
        <Text style={[styles.aside, { color: tokens.muted }]}>{s.hint}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {shown.map((habit) => {
          const why = whyText(habit, now)
          return (
            <NativeContextMenu
              key={habit.key}
              style={styles.cardSlot}
              actions={[{ id: 'hide', title: s.hide, image: 'eye.slash' }]}
              onAction={(id) => {
                if (id === 'hide') hide(habit)
              }}
            >
              <Pressable
                testID={`suggestion-${habit.key}`}
                accessibilityRole="button"
                accessibilityLabel={fmt(s.add, { name: habit.title, why })}
                accessibilityActions={[{ name: 'hide', label: s.hide }]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === 'hide') hide(habit)
                }}
                onPress={() => add(habit)}
                style={({ pressed }) => [
                  styles.card,
                  {
                    backgroundColor: pressed ? tokens.surface2 : tokens.surface,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <UI_ICONS.Plus
                    size={18}
                    color={tokens.accentText}
                    strokeWidth={2.4}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text
                    numberOfLines={1}
                    style={[styles.name, { color: tokens.ink }]}
                  >
                    {capitalise(habit.title)}
                  </Text>
                </View>
                <Text
                  numberOfLines={2}
                  style={[styles.why, { color: tokens.muted }]}
                >
                  {why}
                </Text>
              </Pressable>
            </NativeContextMenu>
          )
        })}
      </ScrollView>
    </View>
  )
}

/**
 * Above the composer's field while a name is typed: up to three completions, history
 * first. A tap adds the completed name: with the amount typed, or else the
 * usual amount from history. When the name is already open on the list, the
 * typed amount is added to that item where the units add up, and otherwise
 * nothing changes: no second row (APP-427).
 */
export function GroceryCompletions({
  listId,
  line,
  tasks,
  onPicked,
}: {
  listId: string
  line: string
  /** The list's items, to say a name is already open on it. */
  tasks: readonly Task[]
  /** A completion was added; the composer clears its line. */
  onPicked: () => void
}) {
  const tokens = useTokens('kitchen')
  const { t } = useI18n()
  const s = t.tasks.grocery.suggestions
  const actions = useTaskActions()
  const habits = useGroceryHabits(listId)
  const cadenceText = useCadenceText()
  const amountText = useGroceryAmountText()

  const completions = groceryCompletions(
    line,
    habits?.habits ?? [],
    groceryNames(),
  )
  if (completions.length === 0) return null
  const typed = parseGroceryLine(line)
  const typedAmount =
    typed.quantity !== null || typed.unit !== null
      ? {
          ...(typed.quantity !== null ? { quantity: typed.quantity } : {}),
          ...(typed.unit !== null ? { unit: typed.unit } : {}),
        }
      : undefined

  const openNamed = (key: string) =>
    tasks.find(
      (task) => !task.done && groceryKey(parseGroceryLine(task.title).name) === key,
    )

  /**
   * What a tap does to an item already open: its amount grows to `to`, or,
   * with no typed amount or one in another measure, nothing changes.
   */
  const mergeInto = (open: Task) => {
    if (!typedAmount) return null
    return addGroceryAmounts(
      {
        ...(open.quantity !== undefined ? { quantity: open.quantity } : {}),
        ...(open.unit !== undefined ? { unit: open.unit } : {}),
      },
      typedAmount,
    )
  }

  const itemOf = (completion: GroceryCompletion) => {
    if (completion.source === 'history') {
      const { habit } = completion
      return {
        key: habit.key,
        title: habit.title,
        ...(typedAmount ?? { quantity: habit.quantity, unit: habit.unit }),
      }
    }
    return {
      key: completion.name.key,
      title: capitalise(completion.name.name),
      ...typedAmount,
    }
  }

  const footnote = (completion: GroceryCompletion, key: string) => {
    const base =
      completion.source === 'dictionary'
        ? `${s.dictionary} · ${t.tasks.grocery.aisles[completion.name.aisle]}`
        : completion.habit.intervalDays !== null
          ? fmt(s.often, { cadence: cadenceText(completion.habit.intervalDays) })
          : completion.habit.category
            ? `${s.history} · ${t.tasks.grocery.aisles[completion.habit.category]}`
            : s.history
    const open = openNamed(key)
    if (!open) return base
    const amount = amountText(open.quantity, open.unit)
    return `${base} · ${amount ? fmt(s.onListAmount, { amount }) : s.onList}`
  }

  return (
    <View testID="grocery-completions" style={styles.completions}>
      {completions.map((completion) => {
        const item = itemOf(completion)
        const open = openNamed(item.key)
        const merged = open ? mergeInto(open) : null
        // Onto an open item only what is typed is added: `+2 pak`.
        const amount = open
          ? merged && typedAmount
            ? `+${amountText(typedAmount.quantity, typedAmount.unit) ?? '1'}`
            : null
          : amountText(item.quantity, item.unit)
        const span = typedSpan(item.title, line)
        return (
          <Pressable
            key={`${completion.source}-${item.key}`}
            testID={`completion-${item.key}`}
            accessibilityRole="button"
            accessibilityLabel={fmt(s.pick, { name: item.title })}
            accessibilityHint={footnote(completion, item.key)}
            onPress={() => {
              onPicked()
              const done = open
                ? merged
                  ? actions.setAmount(
                      open.id,
                      merged.quantity ?? null,
                      merged.unit ?? null,
                    )
                  : Promise.resolve()
                : actions.addGrocery(listId, {
                    title: item.title,
                    quantity: item.quantity,
                    unit: item.unit,
                  })
              done.then(
                () => haptics.itemSaved(),
                () => haptics.actionFailed(),
              )
            }}
            style={({ pressed }) => [
              styles.completion,
              pressed && { backgroundColor: tokens.surface2 },
            ]}
          >
            {completion.source === 'history' ? (
              <UI_ICONS.Clock
                size={18}
                color={tokens.muted}
                strokeWidth={2}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            ) : (
              <UI_ICONS.BookOpen
                size={18}
                color={tokens.muted}
                strokeWidth={2}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            )}
            <View style={styles.completionText}>
              <Text numberOfLines={1} style={[styles.title, { color: tokens.ink }]}>
                {span ? (
                  <>
                    {item.title.slice(0, span[0])}
                    <Text style={styles.typed}>
                      {item.title.slice(span[0], span[1])}
                    </Text>
                    {item.title.slice(span[1])}
                  </>
                ) : (
                  item.title
                )}
              </Text>
              <Text numberOfLines={2} style={[styles.why, { color: tokens.muted }]}>
                {footnote(completion, item.key)}
              </Text>
            </View>
            {amount ? (
              <Text style={[styles.amount, { color: tokens.ink }]}>{amount}</Text>
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: SPACE[2] },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: SPACE[2],
    paddingHorizontal: SPACE[1],
  },
  label: { ...TYPE.footnoteStrong, flexShrink: 1 },
  aside: { ...TYPE.footnote, flexShrink: 1, textAlign: 'right' },
  strip: { gap: SPACE[2] },
  cardSlot: { width: CARD_WIDTH },
  card: {
    width: CARD_WIDTH,
    minHeight: 76,
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACE[3],
    paddingVertical: 10,
    justifyContent: 'space-between',
    gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...TYPE.bodyStrong, flexShrink: 1 },
  why: { ...TYPE.footnote },
  completions: { paddingTop: SPACE[1] },
  completion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    minHeight: SIZE.hitMin,
    paddingHorizontal: SPACE[4],
    paddingVertical: SPACE[2],
  },
  completionText: { flex: 1, gap: 2 },
  title: { ...TYPE.body },
  /** The part of a completion that was typed (design section 2). */
  typed: { fontWeight: TYPE.bodyStrong.fontWeight },
  amount: { ...TYPE.bodyStrong, ...TABULAR },
})
