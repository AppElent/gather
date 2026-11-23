/**
 * Shopping mode (APP-315; `designs/groceries/README.md`, "8. Shopping mode"):
 * a grocery list for one hand, with a basket in the other.
 *
 * Large rows in the list's aisle order, nothing to edit, and the whole row is
 * the button. Checked rows stay where they are (`shoppingIds`), so the list
 * never shifts under a thumb; what another Member checks turns checked live,
 * as Convex sends it. The screen stays on while the mode is showing, and the
 * mode ends by itself after 30 minutes without a tap (`useIdleTimeout`), so
 * a phone put away in a pocket can sleep again. The tab bar hides while the
 * mode is showing (`useHideTabBarWhile`), so the mode has the whole screen.
 *
 * "Done shopping" is the list's Clear checked: the checked items leave the
 * list for Recent, and the staples among them were already back in stock the
 * moment they were checked (`restockCheckedStaples`).
 */
import { Stack, useIsFocused, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { haptics } from '../../feedback/haptics'
import { fmt, plural, useI18n } from '../../i18n'
import { useHideTabBarWhile } from '../../shell/tabBarVisibility'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SIZE, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { InsetList, useInsetSeparator } from '../../ui/inset-list'
import { useKeepAwakeWhile } from '../../ui/use-keep-awake-while'
import { moduleHref } from '../moduleDestination'
import { useCompleteTask } from './completeTask'
import { useGroceryAmountText } from './GroceryFields'
import { aisleSections, inCheckedSection } from './groceryList'
import {
  SHOPPING_IDLE_MS,
  shoppingIds,
  shoppingProgress,
  useIdleTimeout,
} from './shopping'
import { useTaskActions, useTaskList } from './store'
import type { Task } from './types'

const AWAKE_TAG = 'groceries-shopping'

export function ShoppingScreen({ listId }: { listId: string }) {
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t, locale } = useI18n()
  const words = t.tasks.grocery.shopping
  const { list, tasks } = useTaskList(listId)
  const actions = useTaskActions()
  const completeTask = useCompleteTask()
  const amountText = useGroceryAmountText()
  const focused = useIsFocused()
  const [last, setLast] = useState<Task | null>(null)
  const [finishing, setFinishing] = useState(false)

  // What the mode shows grows and never shrinks while it lasts. The rows
  // only count once Convex has answered, as `useLingering` waits for.
  const ready = list?.sync === 'live' || list?.sync === 'synced'
  const shown = useRef<ReadonlySet<string>>(new Set())
  if (ready) shown.current = shoppingIds(shown.current, tasks)
  const rows = tasks.filter((task) => shown.current.has(task.id))
  const sections = aisleSections(rows, list?.aisleOrder)
  const { done, total } = shoppingProgress(rows)

  const leave = () => {
    if (router.canGoBack()) router.back()
    // Opened straight from a link with nothing under it: the list itself.
    else router.replace(moduleHref('/all/groceries'))
  }
  useKeepAwakeWhile(focused, AWAKE_TAG)
  // Full screen, as the design has it (APP-544): leaving in any way unfocuses
  // the screen, and that brings the tab bar back.
  useHideTabBarWhile(focused)
  const touch = useIdleTimeout(focused, SHOPPING_IDLE_MS, leave)

  const toggle = (task: Task) => {
    touch()
    if (task.done) {
      // Unchecking has no buzz of its own in `useCompleteTask`: a tick here
      // says the tap landed, the same as checking does.
      haptics.selectionChanged()
      if (last?.id === task.id) setLast(null)
    } else {
      setLast(task)
    }
    // A check the server refused leaves the row open: no pill for it.
    completeTask(task, (ok) => {
      if (!ok) setLast((current) => (current?.id === task.id ? null : current))
    })
  }

  const undo = () => {
    touch()
    const task = last
    if (!task) return
    setLast(null)
    haptics.selectionChanged()
    actions
      .setDoneInList(listId, false, [task.id])
      .catch(() => haptics.actionFailed())
  }

  const finish = () => {
    touch()
    // Anything in the list's Checked row counts, also what was checked
    // before shopping began and is not shown here.
    const clearable = tasks.some((task) =>
      inCheckedSection(task, list?.checkedClearedAt ?? null),
    )
    if (!clearable) {
      leave()
      return
    }
    setFinishing(true)
    actions
      .clearChecked(listId)
      .then(() => {
        haptics.itemSaved()
        leave()
      })
      .catch(() => {
        haptics.actionFailed()
        setFinishing(false)
      })
  }

  const progress = fmt(words.progress, { done, total })

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerLargeTitle: false,
          title: words.title,
          headerBackVisible: false,
          // Leaving is a choice: Done, or the idle wait. A stray edge swipe
          // with a basket in the other hand should not end the mode.
          gestureEnabled: false,
          headerLeft: () => (
            <Pressable
              testID="shopping-leave"
              accessibilityRole="button"
              accessibilityLabel={t.actions.done}
              hitSlop={8}
              onPress={leave}
              style={styles.barButton}
            >
              <Text style={[styles.barLabel, { color: tokens.ink }]}>
                {t.actions.done}
              </Text>
            </Pressable>
          ),
          headerRight: () => (
            <Text
              testID="shopping-progress"
              accessibilityLabel={fmt(words.progressLabel, { done, total })}
              style={[styles.barProgress, { color: tokens.ink }]}
            >
              {progress}
            </Text>
          ),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          // Room for the pinned footer: the undo pill and Done shopping.
          { paddingBottom: insets.bottom + 160 },
        ]}
      >
        <View style={styles.status}>
          <View style={styles.awake}>
            <UI_ICONS.Sun
              size={14}
              color={tokens.muted}
              strokeWidth={2}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={[styles.awakeText, { color: tokens.muted }]}>
              {fmt(words.awake, { list: list?.name ?? '' })}
            </Text>
          </View>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={fmt(words.progressLabel, { done, total })}
            accessibilityValue={{ min: 0, max: total, now: done }}
            style={[styles.track, { backgroundColor: tokens.surface2 }]}
          >
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: tokens.accentText,
                  width: `${total === 0 ? 0 : Math.round((done * 100) / total)}%`,
                },
              ]}
            />
          </View>
        </View>

        {ready && rows.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.muted }]}>
            {words.empty}
          </Text>
        ) : null}

        {sections.map(({ aisle, tasks: items }) => (
          <View
            key={aisle}
            style={styles.section}
            testID={`shopping-aisle-${aisle}`}
          >
            <View
              accessible
              accessibilityRole="header"
              accessibilityLabel={plural(locale, items.length, {
                one: fmt(t.tasks.grocery.aisleSection.one, {
                  aisle: t.tasks.grocery.aisles[aisle],
                }),
                other: fmt(t.tasks.grocery.aisleSection.other, {
                  aisle: t.tasks.grocery.aisles[aisle],
                }),
              })}
            >
              <Text style={[styles.aisle, { color: tokens.ink }]}>
                {t.tasks.grocery.aisles[aisle]}
              </Text>
            </View>
            <InsetList>
              {items.map((task) => (
                <ShoppingRow
                  key={task.id}
                  task={task}
                  amount={amountText(task.quantity, task.unit) ?? ''}
                  disabled={!list?.writable}
                  onPress={() => toggle(task)}
                />
              ))}
            </InsetList>
          </View>
        ))}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: tokens.ground,
            borderTopColor: tokens.hair,
            paddingBottom: insets.bottom + SPACE[3],
          },
        ]}
      >
        {last ? (
          <View
            testID="shopping-undo"
            style={[styles.undoPill, { backgroundColor: tokens.surface2 }]}
          >
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.undoText, { color: tokens.ink }]}
            >
              {fmt(words.checked, { name: last.title })}
            </Text>
            <Pressable
              testID="shopping-undo-button"
              accessibilityRole="button"
              accessibilityLabel={t.tasks.grocery.undo}
              onPress={undo}
              style={styles.undoButton}
            >
              <Text style={[styles.undoLabel, { color: tokens.ink }]}>
                {t.tasks.grocery.undo}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {list?.writable ? (
          <Pressable
            testID="shopping-finish"
            accessibilityRole="button"
            accessibilityLabel={words.finish}
            accessibilityState={{ busy: finishing, disabled: finishing }}
            disabled={finishing}
            onPress={finish}
            style={({ pressed }) => [
              styles.finish,
              { backgroundColor: tokens.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.finishLabel, { color: tokens.onAccent }]}>
              {words.finish}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </>
  )
}

/**
 * One item, 72 pt tall: a 32 pt disc, the name and the amount at 20 pt. The
 * whole row checks it; a checked row stays, muted and struck through.
 */
function ShoppingRow({
  task,
  amount,
  disabled,
  onPress,
}: {
  task: Task
  amount: string
  disabled: boolean
  onPress: () => void
}) {
  const tokens = useTokens('kitchen')
  const separator = useInsetSeparator()
  const color = task.done ? tokens.muted : tokens.ink
  // The recipe it is for (APP-312), as the normal row's meta shows it.
  const meta = task.notes?.trim().split('\n')[0]
  return (
    <Pressable
      testID={`shopping-row-${task.id}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.done, disabled }}
      accessibilityLabel={[task.title, amount].filter(Boolean).join(', ')}
      accessibilityHint={meta || undefined}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        separator,
        pressed && { backgroundColor: tokens.surface2 },
      ]}
    >
      <View
        style={[
          styles.disc,
          task.done
            ? { backgroundColor: tokens.muted, borderColor: tokens.muted }
            : { borderColor: tokens.accentText },
        ]}
      >
        {task.done ? (
          <UI_ICONS.Check
            size={18}
            color={tokens.ground}
            strokeWidth={3.2}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
      </View>
      {/* The amount wraps under the name at the largest text sizes rather
          than truncating either (designs/groceries, States). */}
      <View style={styles.words}>
        <View style={styles.nameLine}>
          <Text
            style={[
              styles.name,
              {
                color,
                textDecorationLine: task.done ? 'line-through' : 'none',
              },
            ]}
          >
            {task.title}
          </Text>
          {meta ? (
            <Text style={[styles.meta, { color: tokens.muted }]}>{meta}</Text>
          ) : null}
        </View>
        {amount ? (
          <Text style={[styles.amount, { color }]}>{amount}</Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], paddingTop: SPACE[5], gap: SPACE[5] },
  barButton: {
    minHeight: SIZE.hitMin,
    paddingHorizontal: SPACE[2],
    justifyContent: 'center',
  },
  barLabel: { ...TYPE.body },
  barProgress: {
    ...TYPE.bodyStrong,
    paddingHorizontal: SPACE[2],
    ...TABULAR,
  },
  status: { gap: 10 },
  awake: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  awakeText: { ...TYPE.footnote, flexShrink: 1, textAlign: 'center' },
  track: { height: 8, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: 8, borderRadius: RADIUS.pill },
  empty: { ...TYPE.subhead, textAlign: 'center' },
  section: { gap: SPACE[2] },
  aisle: {
    ...TYPE.title3,
    fontWeight: '700',
    paddingHorizontal: SPACE[1],
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: SPACE[4],
  },
  disc: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: SPACE[3],
  },
  nameLine: { flexShrink: 1 },
  name: { ...TYPE.title3 },
  meta: { ...TYPE.subhead },
  amount: { ...TYPE.title3, fontWeight: '700', ...TABULAR },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: SPACE[3],
    paddingHorizontal: SPACE[4],
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  undoPill: {
    minHeight: SIZE.hitMin,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    paddingLeft: SPACE[4],
    paddingRight: 6,
  },
  undoText: { ...TYPE.subhead, flex: 1 },
  undoButton: {
    minHeight: SIZE.hitMin,
    paddingHorizontal: SPACE[3],
    justifyContent: 'center',
  },
  undoLabel: { ...TYPE.subhead, fontWeight: '600' },
  finish: {
    minHeight: 56,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE[4],
  },
  finishLabel: { ...TYPE.bodyStrong, fontWeight: '700' },
})
