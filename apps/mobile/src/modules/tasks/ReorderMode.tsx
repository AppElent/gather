/**
 * Rearranging a list, as a mode.
 *
 * `docs/mobile-interaction.md` is explicit that this is not a gesture: holding
 * a row means "open the menu" everywhere in the app, and continuing that same
 * touch into a drag would claim the gesture before anybody knows it is one.
 * So *Reorder* is an item in that menu and a line in the list's own menu, and
 * entering it changes the screen: handles instead of checkboxes, no swiping,
 * no completing, no completed section, and Done in the nav bar.
 *
 * A row keeps its due date and its labels while being dragged, deliberately.
 * You rearrange by recognising the row, and stripping it back to a title is
 * what makes that harder.
 *
 * The arithmetic is `reorder.ts`. There is still no drag-and-drop dependency
 * here and this is not the change that should add one: a fixed-height list
 * that does not auto-scroll is about eighty lines, and the library is five
 * hundred kilobytes and a native rebuild.
 *
 * The gesture is **`react-native-gesture-handler`, not `PanResponder`.** The
 * first attempt used `PanResponder`, copying the Baby log's arranging bar, and
 * it did not drag on either platform: that bar sits on a screen with nothing
 * scrolling behind it, and this list sits inside a `ScrollView`, which wins
 * every vertical touch. `PanResponder` has no way to say otherwise;
 * `blocksExternalGesture` does, and it is the same library the rows' own swipe
 * already goes through. The gesture is attached to the **grip alone** rather
 * than to the row, which is what leaves the rest of the row free to scroll a
 * list too long to see â€” the same division iOS's own reordering uses.
 */
import { useMemo, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import {
  Gesture,
  GestureDetector,
  type ScrollView as GestureScrollView,
} from 'react-native-gesture-handler'

import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'
import { Card } from './components'
import { dropIndex, movedTo, shiftFor } from '../../arrange/arrange'
import { priorityColor } from './sheets'
import { dueLabel } from './taskDates'
import type { ListDisplay, Task } from './types'

/** Fixed, because the drop arithmetic is a division by it. */
const ROW = 62

/** What a grip needs to talk to the list it belongs to. */
interface DragHandlers {
  begin: (index: number) => void
  move: (dy: number) => void
  end: () => void
}

export function ReorderMode({
  tasks,
  display,
  today,
  scrollRef,
  onDragging,
  onCommit,
}: {
  /** Active tasks only, in their current order. */
  tasks: Task[]
  display: ListDisplay
  today: string
  /**
   * The screen's own `ScrollView`. The drag has to name it to out-rank it â€”
   * without this the list scrolls and the row stays put.
   */
  scrollRef: React.RefObject<GestureScrollView | null>
  /** Belt to the gesture's braces: the list stops scrolling mid-drag. */
  onDragging: (dragging: boolean) => void
  onCommit: (ids: string[]) => void
}) {
  const tokens = useTokens('home')
  const tint = tokens.tintOf('home')
  const { t, locale } = useI18n()

  // The arrangement while the mode is open. Committed on every drop rather
  // than on Done, so leaving by the back gesture cannot lose the work.
  const [order, setOrder] = useState(() => tasks.map((task) => task.id))
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const rows = order.map((id) => byId.get(id)).filter(Boolean) as Task[]

  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  const lift = useRef(new Animated.Value(0)).current
  // Read inside the responder, which is created once and must not close over a
  // stale render's values.
  const live = useRef({ order, drag })
  live.current = { order, drag }

  // The handlers are held in a ref because a grip's gesture is built once per
  // index and must not close over the arrangement as it was three drops ago.
  const handlers = useRef<DragHandlers>({
    begin: () => {},
    move: () => {},
    end: () => {},
  })
  handlers.current = {
    begin: (index) => {
      lift.setValue(0)
      setDrag({ from: index, to: index })
      onDragging(true)
      haptics.selectionChanged()
    },
    move: (dy) => {
      lift.setValue(dy)
      const current = live.current.drag
      if (!current) return
      const to = dropIndex(live.current.order.length, current.from, dy, ROW)
      if (to !== current.to) {
        setDrag({ from: current.from, to })
        // One notch per row crossed: this is the only way to feel where the
        // row will land without watching it.
        haptics.selectionChanged()
      }
    },
    end: () => {
      const current = live.current.drag
      // A tap on the grip that never moved is not a rearrangement, and must
      // not buzz as though something were saved.
      if (current && current.from !== current.to) {
        const next = movedTo(live.current.order, current.from, current.to)
        setOrder(next)
        onCommit(next)
        haptics.itemSaved()
      }
      lift.setValue(0)
      setDrag(null)
      onDragging(false)
    },
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.hint, { backgroundColor: tint.bg }]}>
        <UI_ICONS.GripVertical
          size={17}
          color={tint.fg}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={[styles.hintText, { color: tint.fg }]}>
          {t.labs.list.reorderHint}
        </Text>
      </View>

      {/* Not clipped: a card that hides its overflow cuts the lifted row in
          half the moment it passes the first or last row. */}
      <Card style={styles.dragCard}>
        {rows.map((task, index) => {
          const dragging = drag?.from === index
          const shift = drag ? shiftFor(index, drag.from, drag.to, ROW) : 0
          const meta = [
            display.due && task.dueDate
              ? dueLabel(task.dueDate, today, locale, {
                  today: t.labs.task.today,
                  tomorrow: t.labs.task.tomorrow,
                })
              : null,
            display.priority && task.priority
              ? t.labs.task.priorities[task.priority]
              : null,
            display.labels && task.labels.length > 0
              ? task.labels.join(' Â· ')
              : null,
          ]
            .filter(Boolean)
            .join('  Â·  ')

          return (
            <Animated.View
              key={task.id}
              testID={`reorder-${task.id}`}
              accessibilityLabel={task.title}
              style={[
                styles.row,
                {
                  borderBottomColor: tokens.border,
                  borderBottomWidth:
                    index === rows.length - 1 ? 0 : StyleSheet.hairlineWidth,
                },
                dragging
                  ? {
                      transform: [{ translateY: lift }],
                      backgroundColor: tokens.tile,
                      zIndex: 2,
                      elevation: 4,
                    }
                  : { transform: [{ translateY: shift }] },
              ]}
            >
              <Grip
                index={index}
                handlers={handlers}
                scrollRef={scrollRef}
                color={dragging ? tint.fg : tokens.muted}
                label={task.title}
              />
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor:
                      (display.priority &&
                        priorityColor(task.priority, tokens.danger)) ||
                      'transparent',
                  },
                ]}
              />
              <View style={styles.text}>
                <Text
                  numberOfLines={1}
                  style={[styles.title, { color: tokens.fg }]}
                >
                  {task.title}
                </Text>
                {meta ? (
                  <Text
                    numberOfLines={1}
                    style={[styles.meta, { color: tokens.muted }]}
                  >
                    {meta}
                  </Text>
                ) : null}
              </View>
            </Animated.View>
          )
        })}
      </Card>

      <Text style={[styles.note, { color: tokens.muted }]}>
        {t.labs.list.reorderCompleted}
      </Text>
    </View>
  )
}

/**
 * The one part of the row that drags.
 *
 * `blocksExternalGesture` is what makes the `ScrollView` stand down for this
 * touch and only this touch, so a list longer than the screen still scrolls
 * everywhere else. `runOnJS` keeps the callbacks on the JS thread, where the
 * arrangement state lives â€” this list is short and its animation was never on
 * the UI thread, so there is nothing to win by splitting them.
 */
function Grip({
  index,
  handlers,
  scrollRef,
  color,
  label,
}: {
  index: number
  handlers: React.RefObject<DragHandlers>
  scrollRef: React.RefObject<GestureScrollView | null>
  color: string
  label: string
}) {
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .blocksExternalGesture(scrollRef)
        .onBegin(() => handlers.current.begin(index))
        .onUpdate((event) => handlers.current.move(event.translationY))
        .onFinalize(() => handlers.current.end()),
    [index, handlers, scrollRef],
  )

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityLabel={label}
        hitSlop={{ top: 12, bottom: 12, left: 14, right: 10 }}
        style={styles.grip}
      >
        <UI_ICONS.GripVertical
          size={20}
          color={color}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  dragCard: { overflow: 'visible' },
  hint: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    padding: 11,
    borderRadius: RADIUS.control,
  },
  hintText: { flex: 1, fontSize: 13, lineHeight: 19 },
  row: {
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  grip: { paddingVertical: 12, paddingRight: 2 },
  bar: { width: 3, borderRadius: 2, alignSelf: 'stretch', marginVertical: 14 },
  text: { flex: 1, gap: 4 },
  title: { fontSize: 15.5 },
  meta: { fontSize: 12, fontWeight: '700' },
  note: { fontSize: 12.5, lineHeight: 18, paddingHorizontal: 4 },
})
