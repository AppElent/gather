/**
 * A grocery list's aisle order, the way its store is walked (APP-313;
 * `designs/groceries/README.md` section 6, "Aisles").
 *
 * Cancel, Aisle order, Save in the bar: the order is a draft until Save, so
 * trying an arrangement costs nothing. Every row drags by its grip and has
 * up and down buttons, which are also the VoiceOver path and are disabled at
 * the ends. Restore default order puts the draft back to the default walking
 * order; Save then stores no order at all.
 *
 * The drag is `ReorderMode`'s: a Gesture Handler pan on the grip alone, which
 * names the screen's scroll view so it stands down for that one touch, and the
 * `arrange` arithmetic over measured row heights.
 */
import {
  aisleOrder,
  GROCERY_AISLES,
  type GroceryAisle,
} from '@gather/core/groceries'
import { Stack, useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  Gesture,
  GestureDetector,
  LegacyScrollView as ScrollView,
} from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { dropIndexAcross, movedTo, shiftFor } from '../../arrange/arrange'
import { haptics } from '../../feedback/haptics'
import { fmt, useI18n } from '../../i18n'
import { UI_ICONS } from '../../theme/icons'
import {
  RADIUS,
  SIZE,
  SPACE,
  TABULAR,
  TYPE,
  useTokens,
} from '../../theme/tokens'
import { aisleCounts } from './groceryList'
import { useTaskActions, useTaskList } from './store'

/** What a grip needs to talk to the list it belongs to. */
interface DragHandlers {
  begin: (index: number) => void
  move: (dy: number) => void
  end: () => void
}

export function AisleOrderScreen({ listId }: { listId: string }) {
  const { list, tasks } = useTaskList(listId)
  const tokens = useTokens()
  if (!list) return <View style={{ flex: 1, backgroundColor: tokens.ground }} />
  return (
    <AisleOrderEditor
      listId={list.id}
      name={list.name}
      saved={list.aisleOrder}
      tasks={tasks}
    />
  )
}

function AisleOrderEditor({
  listId,
  name,
  saved,
  tasks,
}: {
  listId: string
  name: string
  saved: readonly GroceryAisle[] | null
  tasks: readonly { category?: string; done: boolean }[]
}) {
  const tokens = useTokens('kitchen')
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useI18n()
  const words = t.tasks.grocery.aisleOrder
  const aisleNames = t.tasks.grocery.aisles
  const actions = useTaskActions()
  const counts = useMemo(() => aisleCounts(tasks), [tasks])

  const [order, setOrder] = useState<GroceryAisle[]>(() => aisleOrder(saved))
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const [dragging, setDragging] = useState(false)

  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  const lift = useRef(new Animated.Value(0)).current
  const live = useRef({ order, drag })
  live.current = { order, drag }
  const heights = useRef(new Map<string, number>())
  const heightOf = (aisle: string | undefined) =>
    (aisle && heights.current.get(aisle)) || SIZE.rowMin

  const handlers = useRef<DragHandlers>({
    begin: () => {},
    move: () => {},
    end: () => {},
  })
  handlers.current = {
    begin: (index) => {
      lift.setValue(0)
      setDrag({ from: index, to: index })
      setDragging(true)
      haptics.selectionChanged()
    },
    move: (dy) => {
      lift.setValue(dy)
      const current = live.current.drag
      if (!current) return
      const to = dropIndexAcross(
        live.current.order.map(heightOf),
        current.from,
        dy,
      )
      if (to !== current.to) {
        setDrag({ from: current.from, to })
        haptics.selectionChanged()
      }
    },
    end: () => {
      const current = live.current.drag
      if (current && current.from !== current.to) {
        setOrder(movedTo(live.current.order, current.from, current.to))
      }
      lift.setValue(0)
      setDrag(null)
      setDragging(false)
    },
  }

  const step = (index: number, by: -1 | 1) => {
    const to = index + by
    if (to < 0 || to >= order.length) return
    haptics.selectionChanged()
    setOrder(movedTo(order, index, to))
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setFailed(false)
    try {
      await actions.setAisleOrder(listId, order)
      haptics.itemSaved()
      router.back()
    } catch {
      haptics.actionFailed()
      setFailed(true)
      setSaving(false)
    }
  }

  const isDefault = order.every((aisle, i) => aisle === GROCERY_AISLES[i])

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          // An inline bar title, as drawn: Cancel and Save sit beside it.
          headerLargeTitle: false,
          title: words.title,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              testID="aisles-cancel"
              accessibilityRole="button"
              accessibilityLabel={t.common.actions.cancel}
              hitSlop={8}
              onPress={() => router.back()}
              style={styles.barButton}
            >
              <Text style={[styles.barLabel, { color: tokens.ink }]}>
                {t.common.actions.cancel}
              </Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              testID="aisles-save"
              accessibilityRole="button"
              accessibilityLabel={words.save}
              accessibilityState={{ busy: saving }}
              disabled={saving}
              hitSlop={8}
              onPress={() => void save()}
              style={[
                styles.barButton,
                styles.saveButton,
                { backgroundColor: tokens.accent },
              ]}
            >
              <Text style={[styles.saveLabel, { color: tokens.onAccent }]}>
                {words.save}
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        scrollEnabled={!dragging}
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={styles.group}>
          <Text
            accessibilityRole="header"
            style={[styles.section, { color: tokens.muted }]}
          >
            {fmt(words.section, { list: name })}
          </Text>
          {/* Not clipped: a card that hides its overflow cuts the lifted row
              in half the moment it passes the first or last row. */}
          <View style={[styles.card, { backgroundColor: tokens.surface }]}>
            {order.map((aisle, index) => {
              const lifted = drag?.from === index
              const shift = drag
                ? shiftFor(
                    index,
                    drag.from,
                    drag.to,
                    heightOf(order[drag.from]),
                  )
                : 0
              const label = aisleNames[aisle]
              const count = counts[aisle]
              return (
                <Animated.View
                  key={aisle}
                  testID={`aisle-row-${aisle}`}
                  onLayout={(event) => {
                    heights.current.set(aisle, event.nativeEvent.layout.height)
                  }}
                  style={[
                    styles.row,
                    {
                      borderTopColor: tokens.hair,
                      borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                    },
                    lifted
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
                    color={lifted ? tokens.ink : tokens.muted}
                  />
                  <Text style={[styles.name, { color: tokens.ink }]}>
                    {label}
                  </Text>
                  {count ? (
                    <Text style={[styles.count, { color: tokens.muted }]}>
                      {count}
                    </Text>
                  ) : null}
                  <StepButton
                    testID={`aisle-up-${aisle}`}
                    label={fmt(words.up, { aisle: label })}
                    disabled={index === 0}
                    onPress={() => step(index, -1)}
                    glyph={UI_ICONS.ChevronUp}
                  />
                  <StepButton
                    testID={`aisle-down-${aisle}`}
                    label={fmt(words.down, { aisle: label })}
                    disabled={index === order.length - 1}
                    onPress={() => step(index, 1)}
                    glyph={UI_ICONS.ChevronDown}
                  />
                </Animated.View>
              )
            })}
          </View>
          <Text style={[styles.footnote, { color: tokens.muted }]}>
            {words.footnote}
          </Text>
        </View>

        {failed ? (
          <Text
            accessibilityRole="alert"
            style={[styles.footnote, { color: tokens.danger }]}
          >
            {words.failed}
          </Text>
        ) : null}

        <Pressable
          testID="aisles-restore"
          accessibilityRole="button"
          accessibilityState={{ disabled: isDefault }}
          disabled={isDefault}
          onPress={() => {
            haptics.selectionChanged()
            setOrder([...GROCERY_AISLES])
          }}
          style={({ pressed }) => [
            styles.restore,
            { backgroundColor: pressed ? tokens.surface2 : tokens.surface },
            isDefault && styles.disabled,
          ]}
        >
          <Text style={[styles.restoreLabel, { color: tokens.ink }]}>
            {words.restore}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  )
}

function StepButton({
  label,
  disabled,
  onPress,
  glyph: Glyph,
  testID,
}: {
  label: string
  disabled: boolean
  onPress: () => void
  glyph: (typeof UI_ICONS)['ChevronUp']
  testID: string
}) {
  const tokens = useTokens()
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Glyph
        size={18}
        color={tokens.ink}
        strokeWidth={2.4}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  )
}

/** The one part of the row that drags; the arrows are the other path. */
function Grip({
  index,
  handlers,
  scrollRef,
  color,
}: {
  index: number
  handlers: React.RefObject<DragHandlers>
  scrollRef: React.RefObject<ScrollView | null>
  color: string
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
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        hitSlop={{ top: 12, bottom: 12, left: 14, right: 10 }}
        style={styles.grip}
      >
        <UI_ICONS.GripVertical size={18} color={color} strokeWidth={2.4} />
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], paddingTop: SPACE[2], gap: SPACE[4] },
  group: { gap: SPACE[2] },
  section: { ...TYPE.footnoteStrong, paddingHorizontal: SPACE[1] },
  card: {
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    paddingLeft: SPACE[4],
  },
  row: {
    minHeight: SIZE.rowMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[2],
    paddingRight: 6,
    marginLeft: -SPACE[4],
    paddingLeft: SPACE[4],
  },
  grip: { paddingVertical: 12 },
  name: { ...TYPE.body, flex: 1 },
  count: { ...TYPE.subhead, ...TABULAR },
  step: {
    width: 40,
    height: SIZE.hitMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: { ...TYPE.footnote, paddingHorizontal: SPACE[1] },
  restore: {
    minHeight: SIZE.rowMin,
    borderRadius: RADIUS.card,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreLabel: { ...TYPE.body },
  // The bar's own glass already pads its items; more crowds the title out on
  // an iPhone SE.
  barButton: {
    minHeight: SIZE.hitMin,
    paddingHorizontal: SPACE[1],
    justifyContent: 'center',
  },
  saveButton: { borderRadius: RADIUS.pill, paddingHorizontal: SPACE[3] },
  barLabel: { ...TYPE.body },
  saveLabel: { ...TYPE.bodyStrong },
  disabled: { opacity: 0.3 },
  pressed: { opacity: 0.6 },
})
