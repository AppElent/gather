/**
 * A short message over the bottom of a screen, with one way back: "Removed
 * from the week menu · Undo". It replaces a confirm dialog for something that
 * is cheap to put back (designs/meal-planner: Remove has an undo, no confirm).
 *
 * The screen owns one `useUndoToast()` and renders its `toast` last, outside
 * its scroll view. A new message replaces the one showing. The message is
 * announced to VoiceOver, and stays a little longer when it is running, so
 * the Undo button can still be reached.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RADIUS, SIZE, SPACE, TYPE, useTokens } from '../theme/tokens'

const SHOWN_MS = 5000
const SHOWN_SCREEN_READER_MS = 10000

interface ToastMessage {
  message: string
  undo?: { label: string; onPress: () => void }
}

/** `clearance`: the height of a bar pinned under the toast, to stay above. */
export function useUndoToast(clearance = 0) {
  const [current, setCurrent] = useState<(ToastMessage & { id: number }) | null>(
    null,
  )
  const next = useRef(0)
  const show = useCallback((toast: ToastMessage) => {
    next.current += 1
    setCurrent({ ...toast, id: next.current })
    AccessibilityInfo.announceForAccessibility(toast.message)
  }, [])
  const hide = useCallback(() => setCurrent(null), [])
  const toast = current ? (
    <UndoToast key={current.id} toast={current} onHide={hide} clearance={clearance} />
  ) : null
  return { show, hide, toast }
}

function UndoToast({
  toast,
  onHide,
  clearance,
}: {
  toast: ToastMessage
  onHide: () => void
  clearance: number
}) {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let live = true
    Animated.timing(opacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start()
    AccessibilityInfo.isScreenReaderEnabled().then((reader) => {
      if (!live) return
      timer = setTimeout(
        () =>
          Animated.timing(opacity, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }).start(() => onHide()),
        reader ? SHOWN_SCREEN_READER_MS : SHOWN_MS,
      )
    })
    return () => {
      live = false
      if (timer) clearTimeout(timer)
    }
  }, [opacity, onHide])

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + clearance + SPACE[4], opacity }]}
    >
      <View
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: tokens.ink }]}
      >
        <Text style={[styles.message, { color: tokens.onInk }]}>
          {toast.message}
        </Text>
        {toast.undo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toast.undo.label}
            hitSlop={12}
            onPress={() => {
              toast.undo?.onPress()
              onHide()
            }}
            style={({ pressed }) => [styles.undo, pressed && styles.pressed]}
          >
            <Text style={[styles.undoLabel, { color: tokens.onInk }]}>
              {toast.undo.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: SPACE[4],
    right: SPACE[4],
    alignItems: 'center',
  },
  toast: {
    minHeight: SIZE.hitMin,
    borderRadius: RADIUS.pill,
    paddingLeft: SPACE[4],
    paddingRight: SPACE[2],
    paddingVertical: SPACE[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    maxWidth: 520,
  },
  message: { ...TYPE.subhead, flexShrink: 1 },
  undo: { paddingHorizontal: SPACE[2], paddingVertical: SPACE[1] },
  undoLabel: { ...TYPE.bodyStrong },
  pressed: { opacity: 0.7 },
})
