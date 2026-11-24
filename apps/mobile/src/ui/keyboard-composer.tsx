/**
 * The keyboard composer (APP-587): one card pinned to the top of the keyboard,
 * for a new task now and a new note (APP-588) or event (APP-589) next. Fast to
 * start — one tap, one line — with the details set before saving, and room to
 * write when a line is not enough. Design: `designs/tasks/quick-add_final.md`.
 *
 * This is the shell every kind shares: the scrim, the drag handle and expand
 * button, the title and description, the chip row, the + menu and the send
 * button. What the chips are, what they say and what their menus do is the
 * kind's (`modules/tasks/AddTaskComposer.tsx` for a task), so the shell knows
 * no Module.
 *
 * Load-bearing choices:
 *
 * - **A transparent `Modal`, not a sheet.** The card tracks the keyboard and
 *   is not a detent, and the scrim has to cover the header and the tab bar,
 *   which a view inside the screen cannot. It has its own safe area: a tab
 *   screen's bottom inset includes the tab bar, which the modal covers. `KeyboardAvoidingView` moves it
 *   with the keyboard's own curve on iOS; Android resizes the modal's window.
 * - **Menus keep the keyboard up.** Each chip and the + are `@expo/ui`'s native
 *   menu, which does not take focus from the field. A date or time wheel
 *   cannot sit in the keyboard's place on iOS, so a kind's `panel` lowers the
 *   keyboard, draws the wheel under the chips, and raises it again when done.
 * - **The whole small card drags, not just the handle** (APP-661). A finger
 *   seldom lands on a 20-point band, so a vertical drag anywhere on the
 *   small card expands or closes it; an expanded card, or one showing a
 *   wheel or calendar, drags by its top band, because those scroll too. What counts as a drag is
 *   `composer-gestures.ts`.
 * - **The card closes; the draft stays.** Every way out (scrim, swipe down,
 *   Android Back, a share from another app) is `onClose`, and the kind keeps what was typed
 *   (`composer-drafts.ts`). Nothing asks to confirm.
 */
import { type MenuAction, MenuView } from '@expo/ui/community/menu'
import {
  type ComponentRef,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  View,
} from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler'
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'

import { openSheet } from '../components/openSheets'
import { useI18n } from '../i18n'
import type { Glyph } from '../theme/glyph'
import { UI_ICONS } from '../theme/icons'
import { type ModuleGroup, RADIUS, SPACE, TYPE, useTokens } from '../theme/tokens'
import {
  type CardHeights,
  closeDistance,
  dragOffset,
  dragOutcome,
} from './composer-gestures'
import { type ComposerMoreItem, composerMoreMenu } from './composer-menu'
import { Modal } from './modal'

export type { ComposerMoreItem } from './composer-menu'

/** One detail on the chip row: its value when set, its name when not. */
export interface ComposerChip {
  id: string
  label: string
  /** Read out: "Date: Tomorrow", "Priority, not set". */
  accessibilityLabel: string
  /** Set chips sit on the group's wash; unset ones on `surface-2`. */
  set: boolean
  icon?: Glyph
  /** Drawn in place of the icon: a list's or a calendar's tile. */
  leading?: ReactNode
  /** The chip's native menu. Ends with Remove when the chip is set. */
  menu?: MenuAction[]
  onMenu?: (actionId: string) => void
  /**
   * A chip without a menu is a plain toggle (a note's Pin): `set` is its
   * state. With neither it only says something (the one grocery list).
   */
  onPress?: () => void
  testID?: string
}

/** What the shell hands the kind to draw its title field with. */
export interface ComposerTitleField {
  inputRef: RefObject<ComponentRef<typeof TextInput> | null>
  style: StyleProp<TextStyle>
  placeholderTextColor: string
  /** Return as a save: the kind's save, then the title focused for the next. */
  onSubmitEditing: () => void
  /** Return as a step to the description (a note's title), opening it. */
  focusBody: () => void
  /** False while a save is answered: nothing in the card changes under it. */
  editable: boolean
}

export interface KeyboardComposerProps {
  /** The Module whose primary colour the send and add buttons wear. */
  group: ModuleGroup
  /** Every way out: scrim, swipe down, Android Back. The kind keeps the draft. */
  onClose: () => void
  /**
   * The title field. The kind draws it, because a task's highlights what was
   * recognised in it (APP-307); the shell owns its focus, style and Return.
   */
  renderTitle: (field: ComposerTitleField) => ReactNode
  /** The description: a line when shown, the whole card when expanded. */
  body: {
    value: string
    onChange: (text: string) => void
    /** Shown while collapsed: chosen from +, or already typed. */
    visible: boolean
    placeholder: string
    accessibilityLabel: string
    /**
     * Several lines while collapsed too (a note's body): Return starts a new
     * line rather than lowering the keyboard, and the field grows to a few
     * lines before it scrolls.
     */
    multiline?: boolean
  }
  /** The row while collapsed: the always-shown chips and the ones set. */
  chips: readonly ComposerChip[]
  /** The row while expanded: every detail of the kind. */
  allChips: readonly ComposerChip[]
  /**
   * The + button's menu, for the details not always shown, then All details
   * after a separator. Every item has an SF Symbol.
   */
  more?: {
    items: ComposerMoreItem[]
    allDetails?: ComposerMoreItem
    onPress: (actionId: string) => void
  }
  canSave: boolean
  /**
   * A save that waits for its answer (All details): the send spins, and the
   * fields and chips hold still until it settles.
   */
  busy?: boolean
  onSave: () => void
  /** A failure the person did not cause, under the chips. */
  notice?: string | null
  /**
   * A wheel drawn where the keyboard was. While it is set the keyboard is
   * down; when it clears, the title takes focus again.
   */
  panel?: ReactNode
  /** Asked when expanding, to bring the description field into view. */
  onExpandedChange?: (expanded: boolean) => void
  /**
   * False for a kind with one size (a grocery item, APP-664): no expand
   * button, and the handle closes the card instead, keeping the draft.
   */
  expandable?: boolean
  /** A card above the composer's own, such as a grocery item's completions. */
  above?: ReactNode
  /** Under the chips: what was just added, and its undo. */
  status?: ReactNode
  /** What the send button is called; Save when not given. */
  saveLabel?: string
  testID?: string
}

export function KeyboardComposer(props: KeyboardComposerProps) {
  // A modal covers the chooser as a sheet does, so a share closes it the way
  // its scrim does, and the kind keeps the draft (APP-672).
  const onClose = useRef(props.onClose)
  onClose.current = props.onClose
  useEffect(() => {
    const open = openSheet(() => onClose.current())
    return open.closed
  }, [])

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={props.onClose}
    >
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.fill}>
          <ComposerCard {...props} />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </Modal>
  )
}

function ComposerCard({
  group,
  onClose,
  renderTitle,
  body,
  chips,
  allChips,
  more,
  canSave,
  busy = false,
  onSave,
  notice,
  panel,
  onExpandedChange,
  expandable = true,
  above,
  status,
  saveLabel,
  testID,
}: KeyboardComposerProps) {
  const tokens = useTokens(group)
  const insets = useSafeAreaInsets()
  const { t } = useI18n()
  const words = t.composer
  const titleRef = useRef<ComponentRef<typeof TextInput>>(null)
  const bodyRef = useRef<ComponentRef<typeof TextInput>>(null)
  const [expanded, setExpanded] = useState(false)
  const [bodyAsked, setBodyAsked] = useState(false)
  const showBody = expanded || body.visible || bodyAsked

  // After a save the next one is typed in the title, wherever the cursor was.
  const submit = () => {
    onSave()
    // A description asked for was for the one just saved.
    setBodyAsked(false)
    if (!panel) titleRef.current?.focus()
  }
  const focusBody = () => {
    setBodyAsked(true)
    // Drawn on this render when it was hidden; focused once it is there.
    requestAnimationFrame(() => bodyRef.current?.focus())
  }
  const keyboardUp = useKeyboardUp()
  const drag = useSharedValue(0)

  const toggle = (next = !expanded) => {
    setExpanded(next)
    onExpandedChange?.(next)
  }

  // A wheel takes the keyboard's place, and gives it back when it closes.
  const hadPanel = useRef(false)
  useEffect(() => {
    if (panel) {
      hadPanel.current = true
      Keyboard.dismiss()
    } else if (hadPanel.current) {
      hadPanel.current = false
      titleRef.current?.focus()
    }
  }, [panel])

  // A vertical drag: up expands, down collapses an expanded card and closes
  // a small one (`composer-gestures.ts`). The small card can be dragged
  // anywhere on it, because a finger seldom lands on the handle's 20 points;
  // a horizontal move is the chip row's scroll, so the drag gives way to it.
  // An expanded card is dragged by its top band only: its description
  // scrolls. The card follows the finger and springs back without a bounce.
  // The card's height at each size, so a drag down from expanded closes
  // once it has passed where the small card sits.
  const heights = useRef<CardHeights>({ small: 0, expanded: 0 })
  const dragPan = (activeOffset: number) =>
    Gesture.Pan()
      .runOnJS(true)
      .activeOffsetY([-activeOffset, activeOffset])
      .failOffsetX([-12, 12])
      .onUpdate((event) => {
        drag.value = dragOffset(event.translationY, expanded, expandable)
      })
      .onEnd((event, success) => {
        // A pan the system cancelled (a call, Control Centre) does nothing.
        if (!success) return
        const outcome = dragOutcome(
          event,
          expanded,
          closeDistance(heights.current),
          expandable,
        )
        if (outcome === 'expand') toggle(true)
        else if (outcome === 'collapse') toggle(false)
        else if (outcome === 'close') onClose()
      })
      .onFinalize(() => {
        drag.value = withSpring(0, { damping: 40, stiffness: 400 })
      })
  const handlePan = dragPan(8)
  // A wheel or calendar in the keyboard's place owns vertical swipes, so the
  // card drags from its handle alone while one is open.
  const cardPan = dragPan(10).enabled(!expanded && !panel)
  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drag.value }],
  }))

  const ExpandIcon = expanded ? UI_ICONS.Collapse : UI_ICONS.Expand
  const expandLabel = expanded ? words.collapse : words.expand
  const shownChips = expanded ? allChips : chips

  const send = (
    <Pressable
      testID={testID ? `${testID}-save` : undefined}
      accessibilityRole="button"
      accessibilityLabel={saveLabel ?? words.save}
      accessibilityState={{ disabled: !canSave, busy }}
      disabled={!canSave || busy}
      onPress={submit}
      hitSlop={4}
      style={({ pressed }) => [
        styles.send,
        { backgroundColor: canSave ? tokens.accent : tokens.surface2 },
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={tokens.onAccent} />
      ) : (
        <UI_ICONS.ArrowUp
          size={20}
          strokeWidth={2.6}
          color={canSave ? tokens.onAccent : tokens.muted}
        />
      )}
    </Pressable>
  )

  const plus = more ? (
    <MenuView
      actions={composerMoreMenu(more.items, more.allDetails)}
      onPressAction={(e) => more.onPress(e.nativeEvent.event)}
    >
      <View
        testID={testID ? `${testID}-more` : undefined}
        accessible
        accessibilityRole="button"
        accessibilityLabel={words.more}
        style={[styles.plus, { borderColor: tokens.hair }]}
      >
        <UI_ICONS.Plus size={18} strokeWidth={2.2} color={tokens.ink} />
      </View>
    </MenuView>
  ) : null

  const chipViews = shownChips.map((chip) => (
    <ChipButton key={chip.id} chip={chip} group={group} />
  ))

  return (
    <>
        <Pressable
          testID={testID ? `${testID}-scrim` : undefined}
          accessibilityRole="button"
          accessibilityLabel={words.close}
          onPress={onClose}
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor:
                tokens.scheme === 'dark'
                  ? 'rgba(0, 0, 0, 0.45)'
                  : 'rgba(26, 31, 29, 0.28)',
            },
          ]}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.fill, { paddingTop: insets.top + SPACE[2] }]}
          pointerEvents="box-none"
        >
          {expanded ? null : <View style={styles.fill} pointerEvents="box-none" />}
          {above && !expanded && !panel ? (
            <View
              style={[styles.above, { backgroundColor: tokens.surface }]}
              testID={testID ? `${testID}-above` : undefined}
            >
              {/* Scrolls when the keyboard leaves too little room for it. */}
              <ScrollView
                bounces={false}
                keyboardShouldPersistTaps="always"
                style={styles.aboveScroll}
              >
                {above}
              </ScrollView>
            </View>
          ) : null}
          <GestureDetector gesture={cardPan}>
          <Animated.View
            testID={testID}
            layout={LinearTransition.duration(220)}
            onLayout={(event) => {
              heights.current[expanded ? 'expanded' : 'small'] =
                event.nativeEvent.layout.height
            }}
            style={[
              styles.card,
              expanded && styles.expanded,
              {
                backgroundColor: tokens.surface,
                marginBottom: SPACE[2] + (keyboardUp ? 0 : insets.bottom),
              },
              dragStyle,
            ]}
          >
            <GestureDetector gesture={handlePan}>
              <Pressable
                testID={testID ? `${testID}-handle` : undefined}
                accessibilityRole="button"
                accessibilityLabel={expandable ? expandLabel : words.closeKeeping}
                onPress={() => (expandable ? toggle() : onClose())}
                style={styles.handleBand}
              >
                <View style={[styles.handle, { backgroundColor: tokens.hair }]} />
              </Pressable>
            </GestureDetector>

            <View style={[styles.titleRow, expanded && styles.grow]}>
              <View style={[styles.fields, expanded && styles.grow]}>
                {renderTitle({
                  inputRef: titleRef,
                  style: [styles.title, { color: tokens.ink }],
                  placeholderTextColor: tokens.muted,
                  onSubmitEditing: submit,
                  focusBody,
                  editable: !busy,
                })}
                {showBody ? (
                  <TextInput
                    ref={bodyRef}
                    editable={!busy}
                    testID={testID ? `${testID}-body` : undefined}
                    value={body.value}
                    onChangeText={body.onChange}
                    placeholder={body.placeholder}
                    placeholderTextColor={tokens.muted}
                    accessibilityLabel={body.accessibilityLabel}
                    multiline={expanded || body.multiline}
                    textAlignVertical="top"
                    style={[
                      expanded ? styles.bodyExpanded : styles.bodyLine,
                      !expanded && body.multiline && styles.bodyLines,
                      expanded && { borderTopColor: tokens.hair },
                      { color: expanded ? tokens.ink : tokens.muted },
                    ]}
                  />
                ) : null}
              </View>
              {expandable ? (
                <Pressable
                  testID={testID ? `${testID}-expand` : undefined}
                  accessibilityRole="button"
                  accessibilityLabel={expandLabel}
                  onPress={() => toggle()}
                  hitSlop={4}
                  style={({ pressed }) => [styles.expand, pressed && styles.pressed]}
                >
                  <ExpandIcon size={18} strokeWidth={2.2} color={tokens.muted} />
                </Pressable>
              ) : null}
            </View>

            <View
              style={[styles.chipRow, expanded && styles.chipRowExpanded]}
              pointerEvents={busy ? 'none' : 'auto'}
            >
              {expanded ? (
                <View style={styles.wrap}>
                  {plus}
                  {chipViews}
                </View>
              ) : (
                <>
                  {plus}
                  <ScrollView
                    horizontal
                    keyboardShouldPersistTaps="always"
                    showsHorizontalScrollIndicator={false}
                    style={styles.fill}
                    contentContainerStyle={styles.scrollChips}
                  >
                    {chipViews}
                  </ScrollView>
                </>
              )}
              {send}
            </View>

            {status}

            {notice ? (
              <Text
                accessibilityRole="alert"
                style={[styles.notice, { color: tokens.danger }]}
              >
                {notice}
              </Text>
            ) : null}

            {panel ? <View style={styles.panel}>{panel}</View> : null}
          </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
    </>
  )
}

function ChipButton({ chip, group }: { chip: ComposerChip; group: ModuleGroup }) {
  const tokens = useTokens(group)
  const Icon = chip.icon
  const face = (
    <>
      {chip.leading ??
        (Icon ? (
          <Icon
            size={16}
            strokeWidth={2.1}
            // Ink on the wash, not the group's text colour: group-coloured
            // marks never sit on a wash (apps/mobile/DESIGN_SYSTEM.md).
            color={chip.set ? tokens.ink : tokens.muted}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null)}
      <Text numberOfLines={1} style={[styles.chipText, { color: tokens.ink }]}>
        {chip.label}
      </Text>
    </>
  )
  const chipStyle = [
    styles.chip,
    chip.leading ? styles.chipWithTile : null,
    { backgroundColor: chip.set ? tokens.tintOf(group).wash : tokens.surface2 },
  ]
  if (!chip.menu && !chip.onPress) {
    return (
      <View
        testID={chip.testID}
        accessible
        accessibilityLabel={chip.accessibilityLabel}
        style={chipStyle}
      >
        {face}
      </View>
    )
  }
  if (!chip.menu) {
    return (
      <Pressable
        testID={chip.testID}
        accessibilityRole="switch"
        accessibilityLabel={chip.accessibilityLabel}
        accessibilityState={{ checked: chip.set }}
        onPress={chip.onPress}
        style={({ pressed }) => [chipStyle, pressed && styles.pressed]}
      >
        {face}
      </Pressable>
    )
  }
  return (
    <MenuView
      actions={chip.menu}
      onPressAction={(event) => chip.onMenu?.(event.nativeEvent.event)}
    >
      <View
        testID={chip.testID}
        accessible
        accessibilityRole="button"
        accessibilityLabel={chip.accessibilityLabel}
        style={chipStyle}
      >
        {face}
      </View>
    </MenuView>
  )
}

/**
 * The round add button on a screen that opens the composer: the Module's
 * primary colour, bottom right, clear of the tab bar (whose height is in the
 * screen's safe area, `TabSafeArea`). Hidden by the caller while the composer
 * is open and where nothing can be added.
 */
export function ComposerAddButton({
  group,
  label,
  onPress,
  testID,
}: {
  group: ModuleGroup
  label: string
  onPress: () => void
  testID?: string
}) {
  const tokens = useTokens(group)
  const insets = useSafeAreaInsets()
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.add,
        {
          backgroundColor: tokens.accent,
          bottom: insets.bottom + SPACE[4],
        },
        pressed && styles.addPressed,
      ]}
    >
      <UI_ICONS.Plus size={28} strokeWidth={2.6} color={tokens.onAccent} />
    </Pressable>
  )
}

/** The room a screen leaves under its content so the add button covers nothing. */
export const ADD_BUTTON_CLEARANCE = 60 + SPACE[4] + SPACE[2]

/** Whether the keyboard is up, from the events that move it. */
function useKeyboardUp(): boolean {
  const [up, setUp] = useState(Keyboard.isVisible())
  useEffect(() => {
    const ios = Platform.OS === 'ios'
    const show = Keyboard.addListener(
      ios ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setUp(true),
    )
    const hide = Keyboard.addListener(
      ios ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setUp(false),
    )
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return up
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flex: 1 },
  card: {
    marginHorizontal: SPACE[2],
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingTop: 20,
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 10,
    shadowColor: '#10201E',
    shadowOpacity: 0.18,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  // Shrinks before the composer's own card does, and its rows then scroll.
  above: {
    flexShrink: 1,
    marginHorizontal: SPACE[2],
    marginBottom: SPACE[2],
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  aboveScroll: { flexGrow: 0 },
  expanded: { flex: 1 },
  // The card's whole width: the handle is 36 points, a finger is not.
  handleBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  handle: { width: 36, height: 5, borderRadius: RADIUS.pill },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  fields: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    ...TYPE.bodyStrong,
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 0,
  },
  bodyLine: { ...TYPE.subhead, paddingVertical: 2, paddingHorizontal: 0 },
  bodyLines: { maxHeight: 4 * 20 + 4 },
  bodyExpanded: {
    ...TYPE.body,
    flex: 1,
    marginTop: SPACE[2],
    paddingTop: 10,
    paddingHorizontal: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  expand: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  chipRowExpanded: { alignItems: 'flex-end' },
  wrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: SPACE[2] },
  scrollChips: { gap: SPACE[2], alignItems: 'center' },
  plus: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    minHeight: 36,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipWithTile: { paddingLeft: 8 },
  chipText: { ...TYPE.subhead },
  send: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: { ...TYPE.footnote },
  // Stretched: a wheel's Host collapses to nothing under `alignItems:
  // 'center'` (expo/expo#46904).
  panel: { alignSelf: 'stretch', gap: SPACE[2] },
  pressed: { opacity: 0.6 },
  add: {
    position: 'absolute',
    right: SPACE[5],
    width: 60,
    height: 60,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10201E',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  addPressed: { transform: [{ scale: 0.96 }] },
})
