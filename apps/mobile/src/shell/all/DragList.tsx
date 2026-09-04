/**
 * A fixed-height list of rows that can be dragged into a new order.
 *
 * Lifted, near enough whole, from `modules/tasks/ReorderMode.tsx`, and the
 * reasoning there is the reasoning here: rearranging is a **mode**, not a
 * gesture, because hold already means "open the menu" everywhere in the app;
 * the arithmetic lives in `arrange/arrange.ts`; and the pan is attached to the
 * **grip alone** so the rest of the row is still free to scroll a list longer
 * than the screen. `blocksExternalGesture` is what makes the enclosing
 * `ScrollView` stand down for that one touch, which `PanResponder` cannot say.
 *
 * `ROW` is fixed because the drop arithmetic divides by it. That is also why
 * the All screen reorders its categories through a separate, compact list of
 * four names rather than by dragging the section headers themselves: a section
 * is as tall as its contents, so there is no single row height to divide by.
 * The alternative was a drag-and-drop dependency, which the Tasks Module
 * already weighed and turned down.
 */
import { useMemo, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import {
  Gesture,
  GestureDetector,
  type ScrollView as GestureScrollView,
} from 'react-native-gesture-handler'

import { dropIndex, movedTo, shiftFor } from '../../arrange/arrange'
import { haptics } from '../../feedback/haptics'
import type { GlyphProps } from '../../theme/glyph'
import { UI_ICONS } from '../../theme/icons'
import { RADIUS, useTokens } from '../../theme/tokens'

export const ROW = 56

export interface DragItem {
  id: string
  label: string
  /** The Module's own glyph, in the Module's own tint. Absent for a category. */
  icon?: React.ComponentType<GlyphProps>
  iconColor?: string
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
  testID,
}: {
  items: DragItem[]
  scrollRef: React.RefObject<GestureScrollView | null>
  onDragging: (dragging: boolean) => void
  onCommit: (ids: string[]) => void
  /** Already resolved into the reader's language, with the row name in it. */
  dragLabel: (label: string) => string
  /** The row's one button: take away, or put back. */
  trailing?: (item: DragItem) => React.ReactNode
  testID?: string
}) {
  const tokens = useTokens()

  // Ordered here as well as by the caller: the mode commits on every drop
  // rather than on Done, so leaving by the back gesture cannot lose the work,
  // and the local copy is what holds the rows still between drop and rerender.
  const [order, setOrder] = useState(() => items.map((item) => item.id))
  const byId = new Map(items.map((item) => [item.id, item]))
  // Reconciled against the caller on every render, so hiding a Module from
  // inside the mode removes its row instead of stranding it.
  const ids = [
    ...order.filter((id) => byId.has(id)),
    ...items.map((item) => item.id).filter((id) => !order.includes(id)),
  ]
  const rows = ids.flatMap((id) => {
    const item = byId.get(id)
    return item ? [item] : []
  })

  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  const lift = useRef(new Animated.Value(0)).current
  const live = useRef({ ids, drag })
  live.current = { ids, drag }

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
      const to = dropIndex(live.current.ids.length, current.from, dy, ROW)
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

  return (
    // Not clipped: a card that hides its overflow cuts the lifted row in half
    // the moment it passes the first or the last one.
    <View
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
      ]}
    >
      {rows.map((item, index) => {
        const dragging = drag?.from === index
        const shift = drag ? shiftFor(index, drag.from, drag.to, ROW) : 0
        const Icon = item.icon
        return (
          <Animated.View
            key={item.id}
            testID={`all-edit-${item.id}`}
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
              color={dragging ? tokens.fg : tokens.muted}
              label={dragLabel(item.label)}
              testID={`all-grip-${item.id}`}
            />
            {Icon ? (
              <Icon
                size={20}
                color={item.iconColor ?? tokens.fg}
                strokeWidth={1.75}
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            ) : null}
            <Text
              numberOfLines={1}
              style={[styles.label, { color: tokens.fg }]}
            >
              {item.label}
            </Text>
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
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: -14,
    paddingHorizontal: 14,
  },
  grip: { paddingVertical: 12, paddingRight: 2 },
  label: { flex: 1, fontSize: 15.5 },
})
