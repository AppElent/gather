/**
 * A bottom sheet you can drag down to dismiss.
 *
 * ## Why this exists rather than a library
 *
 * The obvious answer is `react-native-gesture-handler` + `reanimated`, and both
 * are dependencies. But nothing in this app imports either, and neither is
 * mounted — a gesture-handler sheet would need a `GestureHandlerRootView`
 * wrapping the whole router and the reanimated Babel plugin configured, which
 * is a lot of new machinery under the app's root for one interaction.
 *
 * **This is not the end state.** iOS has had a real sheet since 15
 * (`UISheetPresentationController`) and `react-native-screens` exposes it as a
 * `formSheet` route presentation, which is what the entry detail screen uses.
 * Everything below — the drag, the scrim, the keyboard arithmetic — is this
 * file reimplementing in JavaScript what the platform already does in native
 * code, and reimplementing it is why it has needed three passes. Once the
 * native one is confirmed to feel right, this frame moves onto it and most of
 * this file goes.
 *
 * ## Why the scrim is animated separately from the sheet
 *
 * `Modal animationType="slide"` slides *the whole modal* up from the bottom of
 * the screen — the dim layer included. So the grey travelled with the sheet
 * instead of fading in place, and every open and close dragged a rectangle of
 * shade up and down the screen behind it. The modal now animates nothing
 * (`"none"`); the sheet springs on `translateY` and the scrim fades on
 * `opacity`, which is what the platform's own sheets do.
 *
 * That is also why every exit goes through `dismiss()` rather than calling
 * `onClose` directly: the parent unmounts this component the moment `onClose`
 * fires, so anything that wants an exit animation has to run it first.
 *
 * ## Why the keyboard is measured rather than avoided
 *
 * `KeyboardAvoidingView` inside a `Modal` is unreliable on iOS — the modal is
 * its own window, and the frame the view measures itself against is not the one
 * the keyboard is reported in. A notes box at the bottom of the sheet stayed
 * under the keyboard. So the height comes straight from the keyboard event and
 * does two things: it lifts the sheet, and it caps the sheet's height to the
 * space that is left. Lifting alone would push the top of a tall sheet off the
 * screen.
 *
 * Only on iOS. Android's window is resized by the system, so the sheet has
 * already moved and lifting it again would move it twice.
 *
 * ## Why the grab strip, and only the grab strip
 *
 * Three things rule out putting the gesture anywhere wider.
 *
 * A responder on the whole sheet competes with the `ScrollView` inside it:
 * every scroll starts as a downward drag, so the sheet would follow a finger
 * that meant to scroll the form.
 *
 * A responder on the whole header would have to claim the touch on the
 * **capture** phase — the bubbling `onMoveShouldSetPanResponder` is never
 * reached here, because the header's own children answer first. And capture is
 * negotiated once, at the start of the gesture, before there is any movement to
 * measure: a `dy > 4` test on the capture path can never be true, so it is a
 * responder that silently never fires. Claiming unconditionally would work, and
 * would also swallow the close button's tap.
 *
 * So the drag gets its own strip: the full width, tall enough to hit, with the
 * grabber bar drawn in the middle of it and nothing interactive inside. It can
 * claim every touch it receives without stealing anything.
 *
 * The close button stays regardless. A gesture nobody can see is not an
 * affordance, and it is unreachable with a screen reader.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { useTokens } from '../theme/tokens'

/** How far down, or how fast, counts as "dismiss" rather than "let go". */
const DISMISS_DISTANCE = 110
const DISMISS_VELOCITY = 0.75

const IOS = process.env.EXPO_OS === 'ios'

export interface SheetProps {
  title: string
  /** The small line beside the title — usually who or what this is about. */
  subtitle?: string
  onClose: () => void
  children: ReactNode
  /** Pinned below the scrolling body, out of the scroll. */
  footer?: ReactNode
  /** Before the title — a Back button on a sheet that has an inside. */
  leading?: ReactNode
  /** Share of the screen the sheet may fill, before the keyboard is counted. */
  maxHeight?: number
}

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  leading,
  maxHeight = 0.88,
}: SheetProps) {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { height: screen } = useWindowDimensions()
  const { t } = useI18n()
  const Close = UI_ICONS.X

  // Starts a full screen below, so the first frame is off-stage rather than a
  // sheet that appears at rest and then jumps.
  const translateY = useRef(new Animated.Value(screen)).current
  const shade = useRef(new Animated.Value(0)).current
  const [lift, setLift] = useState(0)

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 32,
        stiffness: 340,
        mass: 0.9,
      }),
      Animated.timing(shade, {
        toValue: 1,
        duration: 190,
        useNativeDriver: true,
      }),
    ]).start()
  }, [translateY, shade])

  useEffect(() => {
    if (!IOS) return
    // `will` rather than `did`: iOS reports the keyboard before it moves, which
    // is what lets the sheet travel with it instead of after it.
    const shown = Keyboard.addListener('keyboardWillShow', (event) =>
      setLift(event.endCoordinates.height),
    )
    const hidden = Keyboard.addListener('keyboardWillHide', () => setLift(0))
    return () => {
      shown.remove()
      hidden.remove()
    }
  }, [])

  // Held in refs because the responder below is created once: capturing either
  // directly would pin the first render's copy of it forever.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])

  const dismiss = useCallback(() => {
    Keyboard.dismiss()
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: screen,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(shade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => close.current())
  }, [translateY, shade, screen])

  const leave = useRef(dismiss)
  useEffect(() => {
    leave.current = dismiss
  }, [dismiss])

  const pan = useRef(
    PanResponder.create({
      // Unconditional, because the strip this sits on holds nothing else. A
      // tap that never moves is a gesture of zero length, which springs back.
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderMove: (_event, gesture) => {
        // Downward only: dragging a bottom sheet up is not a gesture it has,
        // and letting it follow would leave a gap under it.
        if (gesture.dy > 0) translateY.setValue(gesture.dy)
      },
      onPanResponderRelease: (_event, gesture) => {
        const away =
          gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY
        if (away) {
          leave.current()
          return
        }
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start()
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start()
      },
    }),
  ).current

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <View style={styles.host}>
        <Animated.View style={[styles.shade, { opacity: shade }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel={t.actions.close}
            onPress={dismiss}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: tokens.surface,
              // The home indicator only matters when nothing else is down
              // there; with the keyboard up the sheet sits on its top edge.
              paddingBottom: lift > 0 ? 14 : insets.bottom + 22,
              marginBottom: lift,
              // Capped as well as lifted: a sheet tall enough to fill the
              // screen would otherwise have its heading pushed off the top.
              maxHeight: Math.min(screen * maxHeight, screen - lift - 44),
              transform: [{ translateY }],
            },
          ]}
        >
          <View
            {...pan.panHandlers}
            accessibilityLabel={t.actions.close}
            style={styles.handle}
          >
            <View
              style={[styles.grabber, { backgroundColor: tokens.border }]}
            />
          </View>

          <View style={styles.headingWrap}>
            <View style={styles.heading}>
              {leading}
              <View style={styles.headingText}>
                <Text
                  accessibilityRole="header"
                  style={[styles.title, { color: tokens.fg }]}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={[styles.subject, { color: tokens.muted }]}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.actions.close}
                onPress={dismiss}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.close,
                  { backgroundColor: tokens.tile },
                  pressed && styles.pressed,
                ]}
              >
                <Close size={18} color={tokens.muted} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>

          {children}
          {footer}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  host: { flex: 1, justifyContent: 'flex-end' },
  shade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(31, 36, 33, 0.34)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  // Full width and 34 tall, because this is the drag target: the 4px bar
  // inside it is a thing you can see and not a thing you can catch.
  handle: { height: 34, justifyContent: 'center' },
  headingWrap: { paddingTop: 2 },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center' },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  headingText: { flex: 1, gap: 2 },
  title: { fontSize: 21, fontWeight: '700', letterSpacing: -0.4 },
  subject: { fontSize: 13 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
})
