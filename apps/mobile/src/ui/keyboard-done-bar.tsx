/**
 * The bar above the iOS decimal keypad, which has no key to leave it: Done,
 * and Next where there is a next field. React Native core, so it ships over
 * the air. Android has no such accessory and gets none.
 *
 * This is the one file that touches `InputAccessoryView`, which React Native
 * 0.88 deprecates (APP-710); swapping it later changes only this file.
 *
 * Usage: render `accessory` before the `TextInput` (a field that focuses as it
 * mounts must already have its bar) and pass `inputAccessoryViewID` to it.
 * Each field mounts its own, because React Native gives a bar to the first
 * field that names it and to no other.
 *
 * Also pass `key={inputKey}` to the `TextInput`: iOS ties a bar to a field only
 * as it mounts, so a field whose `keyboardType` changes in place must remount
 * (APP-739). A remount drops focus; a field that is focused then re-focuses
 * through its `autoFocus`, and one without it has to be tapped again, which is
 * rare because the type changes with a sheet or step, not mid-typing.
 */
import { type ReactNode, useId } from 'react'
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type TextInputProps,
  View,
} from 'react-native'

import { useI18n } from '../i18n'
import { SIZE, SPACE, TYPE, useTokens } from '../theme/tokens'

function KeyboardDoneBar({
  nativeID,
  onNext,
}: {
  nativeID: string
  onNext?: () => void
}) {
  const tokens = useTokens()
  const { t } = useI18n()
  return (
    <InputAccessoryView nativeID={nativeID}>
      <View
        style={[
          styles.accessory,
          { backgroundColor: tokens.surface, borderTopColor: tokens.hair },
        ]}
      >
        {onNext ? (
          <Pressable
            testID={`${nativeID}-next`}
            accessibilityRole="button"
            hitSlop={12}
            onPress={onNext}
            style={({ pressed }) => [
              styles.accessoryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[TYPE.body, { color: tokens.ink }]}>
              {t.actions.next}
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          testID={`${nativeID}-done`}
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => Keyboard.dismiss()}
          style={({ pressed }) => [
            styles.accessoryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[TYPE.bodyStrong, { color: tokens.ink }]}>
            {t.actions.done}
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  )
}

/**
 * The Done accessory for one field. On iOS with a `decimal-pad` (or other
 * keypad named in `keyboardType` below) `accessory` is the bar and
 * `inputAccessoryViewID` ties the field to it; elsewhere both are undefined.
 */
export function useKeyboardDoneBar({
  keyboardType,
  id,
  onNext,
}: {
  keyboardType?: TextInputProps['keyboardType']
  /** A stable id (such as the field's testID); one is generated otherwise. */
  id?: string
  onNext?: () => void
}): {
  inputAccessoryViewID: string | undefined
  accessory: ReactNode
  /** A `key` for the `TextInput` that follows `keyboardType`. */
  inputKey: string
} {
  const ownId = useId().replaceAll(':', '')
  const needsBar =
    Platform.OS === 'ios' &&
    (keyboardType === 'decimal-pad' || keyboardType === 'number-pad')
  const inputKey = `keyboard-${keyboardType ?? 'default'}`
  if (!needsBar) {
    return { inputAccessoryViewID: undefined, accessory: null, inputKey }
  }
  const nativeID = id ?? `keyboard-done-${ownId}`
  return {
    inputAccessoryViewID: nativeID,
    accessory: <KeyboardDoneBar nativeID={nativeID} onNext={onNext} />,
    inputKey,
  }
}

const styles = StyleSheet.create({
  accessory: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: SIZE.hitMin,
    paddingHorizontal: SPACE[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  accessoryButton: {
    paddingVertical: SPACE[2],
    paddingHorizontal: SPACE[1],
  },
  pressed: { opacity: 0.6 },
})
