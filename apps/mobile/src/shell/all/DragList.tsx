/**
 * A list of rows that can be dragged into a new order.
 *
 * It follows `modules/tasks/ReorderMode.tsx`, and the reasoning there is the
 * reasoning here: rearranging is a **mode**, not a
 * gesture, because hold already means "open the menu" everywhere in the app;
 * the arithmetic lives in `arrange/arrange.ts`; and the pan is attached to the
 * **grip alone** so the rest of the row is still free to scroll a list longer
 * than the screen. `blocksExternalGesture` is what makes the enclosing
 * `ScrollView` stand down for that one touch, which `PanResponder` cannot say.
 *
 * A row's label wraps under Dynamic Type, so each row is measured as it lays
 * out and the drop arithmetic walks those heights. The All screen still
 * reorders its categories through a separate, compact list of four names
 * rather than by dragging the section headers themselves: a section moves its
 * whole contents, which is a different interaction from moving one row. The
 * alternative was a drag-and-drop dependency, which the Tasks Module already
 * weighed and turned down.
 */
import { useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native'
import {
  Gesture,
  GestureDetector,
  type LegacyScrollView as GestureScrollView,
} from 'react-native-gesture-handler'

import { dropIndexAcross, movedTo, shiftFor } from '../../arrange/arrange'
import { haptics } from '../../feedback/haptics'
import type { GlyphProps } from '../../theme/glyph'
import { UI_ICONS } from '../../theme/icons'
import {
  type ModuleGroup,
  RADIUS,
  SIZE,
  SPACE,
  TYPE,
  useTokens,
} from '../../theme/tokens'
import { ModuleTile } from '../../ui/module-tile'

export interface DragItem {
  id: string
  label: string
  /**
   * The Module's own glyph, drawn on its group's tile. Absent for a category.
   */
  icon?: React.ComponentType<GlyphProps>
  /** The group whose `fill` the glyph tile takes. */
  group?: ModuleGroup
  /** A second line under the label, such as whose loyalty card it is. */
  detail?: string
}

interface DragHandlers {
  begin: (index: number) => void
  move: (dy: number) => void
  end: () => void
}

export function DragList({
  items,
  scrollRef,
  onDragging,
  onCommit,
  dragLabel,
  trailing,
  leading,
  testID,
  rowTestID = 'all',
  arrivals = 'last',
  moveActions,
}: {
  items: DragItem[]
  scrollRef: React.RefObject<GestureScrollView | null>
  onDragging: (dragging: boolean) => void
  onCommit: (ids: string[]) => void
  /** Already resolved into the reader's language, with the row name in it. */
  dragLabel: (label: string) => string
  /** The row's one button: take away, or put back. */
  trailing?: (item: DragItem) => React.ReactNode
  /** Drawn before the label instead of the Module tile, such as a store tile. */
  leading?: (item: DragItem) => React.ReactNode
  testID?: string
  /** Rows are `<rowTestID>-edit-<id>`, grips `<rowTestID>-grip-<id>`. */
  rowTestID?: string
  /**
   * Where a row the caller adds while the list is open lands. `'first'` suits
   * a list the server puts new rows on top of, so the row shows where it will
   * be once the next drop saves the order.
   */
  arrivals?: 'first' | 'last'
  /**
   * Gives each row "Move up" and "Move down" for a screen reader, which
   * cannot drag a grip. A move is a drop of one place: it saves the whole
   * order the same way and says where the row went.
   */
  moveActions?: {
    up: string
    down: string
    /** Said after a move; positions count from 1. */
    moved: (label: string, position: number, total: number) => string
  }
}) {
  const tokens = useTokens()

  // Ordered here as well as by the caller: the mode commits on every drop
  // rather than on Done, so leaving by the back gesture cannot lose the work,
  // and the local copy is what holds the rows still between drop and rerender.
  const [order, setOrder] = useState(() => items.map((item) => item.id))
  const byId = new Map(items.map((item) => [item.id, item]))
  // Reconciled against the caller on every render, so hiding a Module from
  // inside the mode removes its row instead of stranding it.
  const kept = order.filter((id) => byId.has(id))
  const arrived = items.map((item) => item.id).filter((id) => !order.includes(id))
  const ids = arrivals === 'first' ? [...arrived, ...kept] : [...kept, ...arrived]
  const rows = ids.flatMap((id) => {
    const item = byId.get(id)
    return item ? [item] : []
  })

  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  const lift = useRef(new Animated.Value(0)).current
  const live = useRef({ ids, drag })
  live.current = { ids, drag }
  // Each row's laid-out height, by id; one not laid out yet counts as the
  // shortest a row can be.
  const heights = useRef(new Map<string, number>())
  const heightOf = (id: string | undefined) =>
    (id && heights.current.get(id)) || SIZE.rowMin

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
      const to = dropIndexAcross(
        live.current.ids.map(heightOf),
        current.from,
        dy,
      )
      if (to !== current.to) {
        setDrag({ from: current.from, to })
        // One notch per row crossed: the only way to feel where the row will
        // land without watching it.
        haptics.selectionChanged()
      }
    },
    end: () => {
      const current = live.current.drag
      // A grip that was touched and never moved is not a rearrangement, and
      // must not buzz as though something had been saved.
      if (current && current.from !== current.to) {
        const next = movedTo(live.current.ids, current.from, current.to)
        setOrder(next)
        onCommit(next)
        haptics.itemSaved()
      }
      lift.setValue(0)
      setDrag(null)
      onDragging(false)
    },
  }

  const moveBy = (index: number, step: -1 | 1) => {
    const to = index + step
    const item = rows[index]
    if (!moveActions || !item || to < 0 || to >= ids.length) return
    const next = movedTo(ids, index, to)
    setOrder(next)
    onCommit(next)
    haptics.itemSaved()
    AccessibilityInfo.announceForAccessibility(
      moveActions.moved(item.label, to + 1, ids.length),
    )
  }

  return (
    // Not clipped: a card that hides its overflow cuts the lifted row in half
    // the moment it passes the first or the last one.
    <View
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.hair },
      ]}
    >
      {rows.map((item, index) => {
        const dragging = drag?.from === index
        const shift = drag
          ? shiftFor(index, drag.from, drag.to, heightOf(rows[drag.from]?.id))
          : 0
        const Icon = item.icon
        return (
          <Animated.View
            key={item.id}
            testID={`${rowTestID}-edit-${item.id}`}
            {...(moveActions
              ? {
                  accessible: true,
                  accessibilityLabel: item.detail
                    ? `${item.label}, ${item.detail}`
                    : item.label,
                  accessibilityActions: [
                    ...(index > 0
                      ? [{ name: 'moveUp', label: moveActions.up }]
                      : []),
                    ...(index < rows.length - 1
                      ? [{ name: 'moveDown', label: moveActions.down }]
                      : []),
                  ],
                  onAccessibilityAction: (event: {
                    nativeEvent: { actionName: string }
                  }) => {
                    const action = event.nativeEvent.actionName
                    if (action === 'moveUp') moveBy(index, -1)
                    if (action === 'moveDown') moveBy(index, 1)
                  },
                }
              : {})}
            onLayout={(event) => {
              heights.current.set(item.id, event.nativeEvent.layout.height)
            }}
            style={[
              styles.row,
              {
                borderBottomColor: tokens.hair,
                borderBottomWidth:
                  index === rows.length - 1 ? 0 : StyleSheet.hairlineWidth,
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
              label={dragLabel(item.label)}
              testID={`${rowTestID}-grip-${item.id}`}
            />
            {leading ? (
              leading(item)
            ) : Icon && item.group ? (
              <ModuleTile group={item.group} glyph={Icon} size="s" />
            ) : null}
            {item.detail ? (
              <View style={styles.text}>
                <Text style={[styles.label, { color: tokens.ink }]}>
                  {item.label}
                </Text>
                <Text style={[styles.detail, { color: tokens.muted }]}>
                  {item.detail}
                </Text>
              </View>
            ) : (
              <Text style={[styles.label, { color: tokens.ink }]}>
                {item.label}
              </Text>
            )}
            {trailing?.(item)}
          </Animated.View>
        )
      })}
    </View>
  )
}

function Grip({
  index,
  handlers,
  scrollRef,
  color,
  label,
  testID,
}: {
  index: number
  handlers: React.RefObject<DragHandlers>
  scrollRef: React.RefObject<GestureScrollView | null>
  color: string
  label: string
  testID: string
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
        testID={testID}
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
  card: {
    borderRadius: RADIUS.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    overflow: 'visible',
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
  label: { ...TYPE.subhead, flex: 1 },
  text: { flex: 1, gap: 2 },
  detail: { ...TYPE.footnote },
})
