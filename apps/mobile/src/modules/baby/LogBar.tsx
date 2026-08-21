/**
 * The strip along the bottom of a Child's log: everything they track, plus the
 * two things that are not log entries at all.
 *
 * ## One row, one kind of thing
 *
 * A to-do and a question used to sit past a hairline divider at the end, fixed
 * there, outside the arrangement. That divider was drawing a distinction the
 * person using the bar does not have: "ask about the rash" is one of the
 * things you reach for while logging, and if it is the thing you reach for
 * most it belongs under your thumb. So every button is a `BabyBarSlot` now —
 * an event type or a shortcut — and they arrange together.
 *
 * The distinction survives where it costs nothing: a shortcut keeps its dashed
 * ring, which travels with it. What it does not do any more is decide where it
 * is allowed to go.
 *
 * ## Two modes
 *
 * **Logging**, which is what it is almost always doing: a scrolling row of
 * fixed-width buttons, one per slot in the Child's own order. Fixed width so
 * the row scrolls rather than shrinking below a 44px target once a Child
 * tracks all eight types and keeps both shortcuts.
 *
 * **Arranging**, entered by holding a button down. The row stops scrolling and
 * lays every button out at an equal share of the width — which is what makes
 * "which slot is the finger over" a division rather than a hit test, and is
 * why arranging does not need the auto-scrolling that a drag inside a
 * scrolling row would. The labels go, because ten buttons only fit without
 * them.
 *
 * ## Why a mode rather than a drag straight out of the long press
 *
 * Continuing the *same* touch from a long press into a drag means claiming the
 * gesture before anybody knows it is a drag, which takes the touch away from
 * the ScrollView and from the button's own tap. Splitting it in two lets each
 * half use a mechanism that is unambiguous: `onLongPress` to enter, and then —
 * with scrolling off and nothing else competing — a pan responder that can
 * claim every touch it receives.
 *
 * Settings can arrange these too, with arrows, and both write the same ordered
 * `barOrder` array. This is the one you find; that is the one you can use with
 * a screen reader.
 */
import { type BabyBarSlot, isBabyBarShortcut } from '@gather/core/domain'
import { useRef, useState } from 'react'
import {
  Animated,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { haptics } from '../../haptics'
import { fmt, type Messages, useI18n } from '../../i18n'
import type { Glyph } from '../../theme/glyph'
import { RADIUS, useTokens } from '../../theme/tokens'
import { BABY_UI_ICONS, EVENT_ICONS } from './icons'
import { dragTarget, movedTo, residualOffset } from './logBarArrange'

/** The width of one button while logging. Arranging measures its own. */
const ITEM_WIDTH = 61

/**
 * How much room the bar leaves under itself.
 *
 * The bottom inset is the whole of what is down there that is not ours. On iOS
 * the native tab bar is translucent and this screen is drawn *underneath* it,
 * so UIKit reports the tab bar's height as part of the inset — and the bar was
 * spending that inset on a flat 4px, which is exactly how it ended up behind
 * the tab bar. On Android the tab bar is a sibling view with the screen above
 * it, so the inset there is small or zero.
 *
 * The inset is now paid *and then some*. Spending it exactly leaves the labels
 * flush against the tab bar's own edge, which still reads as behind it — which
 * is what the second round of iOS feedback was about. `BAR_GAP` is that gap,
 * and it is the only number here that is taste rather than measurement.
 */
const BAR_GAP = 7
const barBottom = (inset: number) => inset + BAR_GAP

/** The glyph for one slot, whichever kind of thing it is. */
export function slotIcon(slot: BabyBarSlot): Glyph {
  if (slot === 'todo') return BABY_UI_ICONS.ListChecks
  if (slot === 'question') return BABY_UI_ICONS.CircleQuestionMark
  return EVENT_ICONS[slot]
}

/** Its name, in the reader's language (ADR-0011). */
export function slotLabel(slot: BabyBarSlot, t: Messages): string {
  if (slot === 'todo') return t.baby.log.quickLog.addTodo
  if (slot === 'question') return t.baby.log.quickLog.addQuestion
  return t.baby.eventTypes[slot]
}

export interface LogBarProps {
  slots: readonly BabyBarSlot[]
  onPick: (slot: BabyBarSlot) => void
  /** The whole new arrangement, ready for `babies.update`. */
  onReorder: (next: BabyBarSlot[]) => void
}

export function LogBar({ slots, onPick, onReorder }: LogBarProps) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const tint = tokens.tintOf('home')

  const [arranging, setArranging] = useState(false)
  const [order, setOrder] = useState<readonly BabyBarSlot[]>(slots)
  const [held, setHeld] = useState<BabyBarSlot | null>(null)
  const [width, setWidth] = useState(0)

  if (!arranging && order !== slots) setOrder(slots)

  function beginArranging(slot: BabyBarSlot) {
    // The one moment in this Module that most wants a haptic: nothing has
    // moved yet, so the tap is the only signal that the hold was long enough
    // and the button is now yours to drag.
    haptics.lifted()
    setOrder(slots)
    setArranging(true)
    setHeld(slot)
  }

  function finish() {
    setArranging(false)
    setHeld(null)
    // Only when it actually moved: an arrange somebody entered and left
    // unchanged should not be a write, or a row in anyone's activity feed.
    const changed =
      order.length !== slots.length ||
      order.some((each, index) => each !== slots[index])
    if (changed) onReorder([...order])
  }

  const measure = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width)

  if (arranging) {
    const slotWidth = order.length > 0 ? width / order.length : 0
    return (
      <View
        style={[
          styles.bar,
          {
            backgroundColor: tokens.surface,
            borderTopColor: tokens.border,
            paddingBottom: barBottom(insets.bottom),
          },
        ]}
      >
        <View style={styles.arrangeHead}>
          <Text style={[styles.arrangeHint, { color: tokens.muted }]}>
            {t.baby.log.tracked.arrangeHint}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={finish}
            hitSlop={10}
            style={({ pressed }) => [
              styles.done,
              { backgroundColor: tint.bg },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.doneText, { color: tint.fg }]}>
              {t.actions.done}
            </Text>
          </Pressable>
        </View>

        <View style={styles.arrangeRow} onLayout={measure}>
          {order.map((slot, index) => (
            <ArrangeItem
              key={slot}
              slot={slot}
              index={index}
              width={slotWidth}
              order={order}
              lifted={held === slot}
              onHold={() => setHeld(slot)}
              onOrder={setOrder}
            />
          ))}
        </View>
      </View>
    )
  }

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: tokens.surface,
          borderTopColor: tokens.border,
          paddingBottom: barBottom(insets.bottom),
        },
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {slots.map((slot) => {
          const Icon = slotIcon(slot)
          const label = slotLabel(slot, t)
          const shortcut = isBabyBarShortcut(slot)
          return (
            <Pressable
              key={slot}
              accessibilityRole="button"
              accessibilityLabel={
                shortcut
                  ? label
                  : fmt(t.baby.log.entry.logTitle, { type: label })
              }
              accessibilityHint={t.baby.log.tracked.arrangeHold}
              onPress={() => onPick(slot)}
              onLongPress={() => beginArranging(slot)}
              delayLongPress={350}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <View
                style={[
                  styles.circle,
                  shortcut
                    ? [styles.circleDashed, { borderColor: tokens.border }]
                    : { backgroundColor: tint.bg },
                ]}
              >
                <Icon
                  size={21}
                  color={shortcut ? tokens.muted : tint.fg}
                  strokeWidth={1.9}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.label, { color: tokens.muted }]}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

/**
 * One button while the bar is arranging.
 *
 * Its pan responder claims every touch unconditionally, which is safe only
 * because arranging has already turned the scrolling off and the button's own
 * tap with it — see the note at the top of this file for why the alternative
 * (one continuous gesture from the long press) cannot.
 */
function ArrangeItem({
  slot,
  index,
  width,
  order,
  lifted,
  onHold,
  onOrder,
}: {
  slot: BabyBarSlot
  index: number
  width: number
  order: readonly BabyBarSlot[]
  lifted: boolean
  onHold: () => void
  onOrder: (next: BabyBarSlot[]) => void
}) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const tint = tokens.tintOf('home')
  const Icon = slotIcon(slot)
  const shortcut = isBabyBarShortcut(slot)

  const offset = useRef(new Animated.Value(0)).current
  // The lift. iOS scales a dragged item up a little rather than outlining it,
  // and that is most of what makes one read as picked up rather than selected.
  const lift = useRef(new Animated.Value(1)).current

  // The responder is created once, so everything it needs that changes between
  // renders is read through a ref rather than captured.
  const live = useRef({ index, width, order, onOrder, onHold })
  live.current = { index, width, order, onOrder, onHold }

  // Where this drag began. Both are frozen at grant, because `gesture.dx` is
  // measured from the start of the gesture and so must be resolved against the
  // start of the gesture. Reading the *live* index each move compounds: the
  // button has already moved two slots, so the same dx moves it two more.
  const from = useRef({ index: 0, order: order })

  /** The slot the last move reported, so a haptic fires once per crossing. */
  const settled = useRef(0)

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        from.current = { index: live.current.index, order: live.current.order }
        settled.current = live.current.index
        live.current.onHold()
        Animated.spring(lift, {
          toValue: 1.12,
          useNativeDriver: true,
          bounciness: 6,
        }).start()
      },
      onPanResponderMove: (_event, gesture) => {
        const itemWidth = live.current.width
        const start = from.current
        const to = dragTarget(
          start.order.length,
          start.index,
          gesture.dx,
          itemWidth,
        )
        // One notch per slot crossed, not per move event: `dragTarget` is a
        // rounded division, so it reports the same slot for most of a drag and
        // this fires only when the arrangement actually changed.
        if (to !== settled.current) {
          settled.current = to
          haptics.selected()
        }
        live.current.onOrder(movedTo(start.order, start.index, to))
        offset.setValue(residualOffset(gesture.dx, start.index, to, itemWidth))
      },
      onPanResponderRelease: () => {
        Animated.parallel([
          Animated.spring(offset, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }),
          Animated.spring(lift, {
            toValue: 1,
            useNativeDriver: true,
            bounciness: 0,
          }),
        ]).start()
      },
      onPanResponderTerminate: () => {
        offset.setValue(0)
        lift.setValue(1)
      },
    }),
  ).current

  return (
    <Animated.View
      {...pan.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={slotLabel(slot, t)}
      style={[
        styles.arrangeItem,
        {
          width: width || undefined,
          transform: [
            { translateX: lifted ? offset : 0 },
            { scale: lifted ? lift : 1 },
          ],
        },
        lifted && styles.arrangeLifted,
      ]}
    >
      <View
        style={[
          styles.circle,
          shortcut
            ? [styles.circleDashed, { borderColor: tokens.border }]
            : { backgroundColor: tint.bg },
          lifted && { borderColor: tokens.accent, borderWidth: 2 },
        ]}
      >
        <Icon
          size={21}
          color={shortcut ? tokens.muted : tint.fg}
          strokeWidth={1.9}
        />
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 9,
    paddingHorizontal: 12,
  },
  row: { gap: 0 },
  item: {
    // Fixed rather than flexed: the bar holds every tracked type, so past six
    // it must scroll instead of shrinking below a 44px target.
    width: ITEM_WIDTH,
    alignItems: 'center',
    gap: 5,
  },
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // What still separates "record what happened" from "remind me later", now
  // that they share a row and an arrangement.
  circleDashed: { borderWidth: 1, borderStyle: 'dashed' },
  label: { fontSize: 10.5 },
  arrangeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 8,
  },
  arrangeHint: { flex: 1, fontSize: 12.5 },
  done: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: RADIUS.control,
  },
  doneText: { fontSize: 14, fontWeight: '700' },
  arrangeRow: { flexDirection: 'row', alignItems: 'center' },
  arrangeItem: { alignItems: 'center', paddingVertical: 4 },
  arrangeLifted: { zIndex: 2 },
  pressed: { opacity: 0.6 },
})
