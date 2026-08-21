import type { ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native'
import ReanimatedSwipeable, {
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable'

import { haptics } from '../feedback/haptics'
import { useTokens } from '../theme/tokens'

/** Swipe-left exposes, but never immediately performs, a permanent delete. */
export function SwipeableRow({
  children,
  deleteLabel,
  onDelete,
}: {
  children: ReactNode
  deleteLabel: string
  onDelete: () => void
}) {
  const tokens = useTokens('home')

  return (
    <ReanimatedSwipeable
      rightThreshold={72}
      overshootRight={false}
      onSwipeableWillOpen={(direction) => {
        if (direction === SwipeDirection.RIGHT) haptics.swipeThresholdPassed()
      }}
      renderRightActions={(_progress, _translation, swipeable) => (
        <View style={[styles.actionWrap, { backgroundColor: tokens.danger }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={deleteLabel}
            onPress={() => {
              swipeable.close()
              onDelete()
            }}
            style={styles.action}
          >
            <Text style={[styles.label, { color: tokens.surface }]}>
              {deleteLabel}
            </Text>
          </Pressable>
        </View>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  )
}

const styles = StyleSheet.create<{
  actionWrap: ViewStyle
  action: ViewStyle
  label: TextStyle
}>({
  actionWrap: { justifyContent: 'center' },
  action: {
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  label: { fontSize: 15, fontWeight: '700' },
})
