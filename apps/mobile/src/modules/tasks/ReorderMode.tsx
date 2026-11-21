/**
 * Rearranging a list, as a mode.
 *
 * `apps/mobile/DESIGN_SYSTEM.md` is explicit that this is not a gesture: holding
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
 * The arithmetic is `arrange/arrange.ts`. Rows wrap their title under Dynamic
 * Type, so each row is measured as it lays out and the drop arithmetic walks
 * those heights rather than dividing by one. On a list with sections each
 * section's heading is a fixed row in the same column, and a task dragged
 * past one moves into that section (`sectionArrange.ts`, APP-357). On a
 * grocery list the headings are its aisles, every one in the list's aisle
 * order, and an item dragged under another aisle moves there (APP-522).
 * There is no drag-and-drop
 * dependency: a list that does not auto-scroll is short, and the library is
 * five hundred kilobytes and a native rebuild.
 *
 * The gesture is **`react-native-gesture-handler`, not `PanResponder`.**
 * `PanResponder`, which the Baby log's arranging bar uses, does not drag here
 * on either platform: that bar sits on a screen with nothing scrolling behind
 * it, and this list sits inside a `ScrollView`, which wins every vertical
 * touch. `PanResponder` has no way to say otherwise;
 * `blocksExternalGesture` does, and it is the same library the rows' own swipe
 * already goes through. The gesture is attached to the **grip alone** rather
 * than to the row, which is what leaves the rest of the row free to scroll a
 * list too long to see — the same division iOS's own reordering uses.
 */
import type { TaskSection } from '@gather/core/task-lists'
import { useMemo, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import {
  Gesture,
  GestureDetector,
  type LegacyScrollView as GestureScrollView,
} from 'react-native-gesture-handler'
import { dropIndexAcross, movedTo, shiftFor } from '../../arrange/arrange'
import { haptics } from '../../feedback/haptics'
import { useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../../theme/tokens'
import { Card } from '../../ui/card'
import { priorityColor } from './components'
import {
  arrangementOf,
  committed,
  firstDropIndex,
  headingSection,
  sectionMove,
} from './sectionArrange'
import { dueLabel } from './taskDates'
import type { ListDisplay, Task } from './types'

/** What a grip needs to talk to the list it belongs to. */
interface DragHandlers {
  begin: (index: number) => void
  move: (dy: number) => void
  end: () => void
}

export function ReorderMode({
  tasks,
  sections = [],
  arrangement,
  hint,
  note,
  display,
  today,
  scrollRef,
  onDragging,
  onCommit,
}: {
  /** Active tasks only, in their current order. */
  tasks: Task[]
  /** The list's sections; a task dragged under a heading joins it. */
  sections?: readonly TaskSection[]
  /**
   * The column to open with, when it is not the list's own sections: a
   * grocery list's aisles (`aisleArrangement`, APP-522), whose headings are
   * named by `sections` and which has no "No section".
   */
  arrangement?: readonly string[]
  /** The banner's words, and the line under the column, when not a task list's. */
  hint?: string
  note?: string
  display: ListDisplay
  today: string
  /**
   * The screen's own `ScrollView`. The drag has to name it to out-rank it —
   * without this the list scrolls and the row stays put.
   */
  scrollRef: React.RefObject<GestureScrollView | null>
  /** Belt to the gesture's braces: the list stops scrolling mid-drag. */
  onDragging: (dragging: boolean) => void
  /**
   * The task ids in order and, on a list with sections, each one's section;
   * `moved` is the dragged task's new section when the drop changed it.
   */
  onCommit: (
    ids: string[],
    sectionIds?: (string | null)[],
    moved?: { id: string; sectionId: string | null },
  ) => void
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()

  // The arrangement while the mode is open. Committed on every drop rather
  // than on Done, so leaving by the back gesture cannot lose the work.
  const [order, setOrder] = useState(() =>
    arrangement ? [...arrangement] : arrangementOf(sections, tasks),
  )
  const sectioned = sections.length > 0
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const names = new Map(sections.map((section) => [section.id, section.name]))
  // A heading row, or a task still on the list: a task deleted elsewhere
  // while the mode is open drops out.
  const rows = order.filter(
    (key) => headingSection(key) !== undefined || byId.has(key),
  )

  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  const lift = useRef(new Animated.Value(0)).current
  // Read inside the responder, which is created once and must not close over a
  // stale render's values.
  const live = useRef({ order, drag })
  live.current = { order, drag }
  // Each row's laid-out height, by task id. A row that has not laid out yet
  // counts as the shortest a row can be.
  const heights = useRef(new Map<string, number>())
  const heightOf = (id: string | undefined) =>
    (id && heights.current.get(id)) || SIZE.rowMin

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
      // Nothing lands above the first heading: every task is in a section
      // or under "No section".
      const to = Math.max(
        firstDropIndex(live.current.order),
        dropIndexAcross(live.current.order.map(heightOf), current.from, dy),
      )
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
        const before = live.current.order
        const next = movedTo(before, current.from, current.to)
        setOrder(next)
        const { ids, sectionIds } = committed(next)
        const id = before[current.from]
        const sectionId = sectionMove(before, next, id)
        onCommit(
          ids,
          sectionIds,
          sectionId === undefined ? undefined : { id, sectionId },
        )
        haptics.itemSaved()
      }
      lift.setValue(0)
      setDrag(null)
      onDragging(false)
    },
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.hint, { backgroundColor: tokens.surface2 }]}>
        <UI_ICONS.GripVertical
          size={17}
          color={tokens.ink}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <Text style={[styles.hintText, { color: tokens.ink }]}>
          {hint ?? t.tasks.list.reorderHint}
        </Text>
      </View>

      {/* Not clipped: a card that hides its overflow cuts the lifted row in
          half the moment it passes the first or last row. */}
      <Column sectioned={sectioned}>
        {rows.map((key, index) => {
          const shift = drag
            ? shiftFor(index, drag.from, drag.to, heightOf(rows[drag.from]))
            : 0
          const heading = headingSection(key)
          if (heading !== undefined) {
            return (
              <Animated.View
                key={key}
                testID={`reorder-heading-${heading ?? 'none'}`}
                accessibilityRole="header"
                onLayout={(event) => {
                  heights.current.set(key, event.nativeEvent.layout.height)
                }}
                style={[
                  styles.heading,
                  index === 0 && styles.firstHeading,
                  { transform: [{ translateY: shift }] },
                ]}
              >
                <Text style={[styles.headingText, { color: tokens.muted }]}>
                  {/* A section deleted on another phone while Reorder is
                      open: its tasks already sit under "No section" there. */}
                  {heading === null
                    ? t.tasks.sections.none
                    : (names.get(heading) ?? t.tasks.sections.none)}
                </Text>
              </Animated.View>
            )
          }
          const task = byId.get(key) as Task
          const dragging = drag?.from === index
          // On a sectioned list each section is its own inset card: the first
          // and last task under a heading carry its corners.
          const firstInSection =
            index === 0 || headingSection(rows[index - 1]) !== undefined
          const lastInSection =
            index === rows.length - 1 ||
            headingSection(rows[index + 1]) !== undefined
          const meta = [
            display.due && task.dueDate
              ? dueLabel(task.dueDate, today, locale, {
                  today: t.tasks.task.today,
                  tomorrow: t.tasks.task.tomorrow,
                })
              : null,
            display.priority && task.priority
              ? t.tasks.task.priorities[task.priority]
              : null,
            display.labels && task.labels.length > 0
              ? task.labels.join(' · ')
              : null,
          ]
            .filter(Boolean)
            .join('  ·  ')

          return (
            <Animated.View
              key={task.id}
              testID={`reorder-${task.id}`}
              accessibilityLabel={task.title}
              onLayout={(event) => {
                heights.current.set(task.id, event.nativeEvent.layout.height)
              }}
              style={[
                styles.row,
                sectioned && [
                  styles.sectionRow,
                  { backgroundColor: tokens.surface },
                  firstInSection && styles.sectionTop,
                  lastInSection && styles.sectionBottom,
                ],
                {
                  borderBottomColor: tokens.hair,
                  borderBottomWidth: lastInSection
                    ? 0
                    : StyleSheet.hairlineWidth,
                },
                dragging
                  ? {
                      transform: [{ translateY: lift }],
                      backgroundColor: tokens.surface2,
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
                color={dragging ? tokens.ink : tokens.muted}
                label={task.title}
              />
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor:
                      (display.priority &&
                        priorityColor(task.priority, tokens)) ||
                      'transparent',
                  },
                ]}
              />
              <View style={styles.text}>
                <Text style={[styles.title, { color: tokens.ink }]}>
                  {task.title}
                </Text>
                {meta ? (
                  <Text style={[styles.meta, { color: tokens.muted }]}>
                    {meta}
                  </Text>
                ) : null}
              </View>
            </Animated.View>
          )
        })}
      </Column>

      <Text style={[styles.note, { color: tokens.muted }]}>
        {note ?? t.tasks.list.reorderCompleted}
      </Text>
    </View>
  )
}

/**
 * The draggable column: one `Card` for a list without sections; on a list
 * with them, bare, because each section's rows draw their own card and the
 * headings sit on the list's `ground` between them.
 */
function Column({
  sectioned,
  children,
}: {
  sectioned: boolean
  children: React.ReactNode
}) {
  if (sectioned) return <View>{children}</View>
  return <Card style={styles.dragCard}>{children}</Card>
}

/**
 * The one part of the row that drags.
 *
 * `blocksExternalGesture` is what makes the `ScrollView` stand down for this
 * touch and only this touch, so a list longer than the screen still scrolls
 * everywhere else. `runOnJS` keeps the callbacks on the JS thread, where the
 * arrangement state lives — this list is short and its animation was never on
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
    borderRadius: RADIUS.card,
  },
  hintText: { ...TYPE.footnote, flex: 1 },
  /**
   * A section's heading in the draggable column, set as `SectionLabel` is:
   * the rows of every section still share one coordinate space, which is
   * what lets a task be dragged from one section into the next.
   */
  heading: {
    paddingHorizontal: 4,
    paddingTop: SPACE[4],
    paddingBottom: SPACE[2],
  },
  firstHeading: { paddingTop: 0 },
  headingText: { ...TYPE.footnoteStrong },
  sectionRow: { marginHorizontal: 0, borderCurve: 'continuous' },
  sectionTop: {
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
  },
  sectionBottom: {
    borderBottomLeftRadius: RADIUS.card,
    borderBottomRightRadius: RADIUS.card,
  },
  row: {
    minHeight: SIZE.rowMin,
    paddingVertical: SPACE[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  grip: { paddingVertical: 12, paddingRight: 2 },
  bar: { width: 3, borderRadius: 2, alignSelf: 'stretch', marginVertical: 14 },
  text: { flex: 1, gap: 4 },
  title: { ...TYPE.body },
  meta: { ...TYPE.footnoteStrong },
  note: { ...TYPE.footnote, paddingHorizontal: 4 },
})
