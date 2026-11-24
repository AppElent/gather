/**
 * A number typed inline in its row (docs/standards/number-fields.md,
 * ordinary entry): the row's name and an optional line under it, a decimal
 * field and its unit beside it, spoken with the field. The text is kept as
 * typed; the screen parses it at its own commit boundary (blur and Save).
 *
 * A problem is said in words under the row, in `danger` with the alert role,
 * and the field is outlined in `danger`, so colour is never the only signal.
 */
import { forwardRef } from 'react'
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  View,
} from 'react-native'

import { SPACE, TABULAR, TYPE, useTokens } from '../../../theme/tokens'
import { useInsetSeparator } from '../../../ui/inset-list'
import { useKeyboardDoneBar } from '../../../ui/keyboard-done-bar'

export const EnergyNumberRow = forwardRef<
  TextInputInstance,
  {
    label: string
    sub?: string
    unit: string
    value: string
    onChangeText: (text: string) => void
    problem?: string | null
    testID?: string
    /** `default` for a name typed in the same row grammar. */
    keyboardType?: TextInputProps['keyboardType']
    returnKeyType?: TextInputProps['returnKeyType']
    /** Moves to the next field, from the bar above the decimal keypad. */
    onNext?: () => void
    onSubmitEditing?: () => void
    onBlur?: () => void
    autoFocus?: boolean
    placeholder?: string
    maxLength?: number
    wide?: boolean
  }
>(function EnergyNumberRow(
  {
    label,
    sub,
    unit,
    value,
    onChangeText,
    problem,
    testID,
    keyboardType = 'decimal-pad',
    returnKeyType,
    onNext,
    onSubmitEditing,
    onBlur,
    autoFocus,
    placeholder,
    maxLength,
    wide,
  },
  ref,
) {
  const tokens = useTokens()
  const separator = useInsetSeparator()
  const { inputAccessoryViewID: barId, accessory } = useKeyboardDoneBar({
    keyboardType,
    id: testID,
    onNext,
  })
  return (
    <View style={styles.inset}>
    <View style={[styles.wrap, separator]}>
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={[TYPE.body, { color: tokens.ink }]}>{label}</Text>
          {sub ? (
            <Text style={[TYPE.footnote, { color: tokens.muted }]}>{sub}</Text>
          ) : null}
        </View>
        {/* Before the field: one that focuses as it mounts must have its bar. */}
        {accessory}
        <TextInput
          ref={ref}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          inputAccessoryViewID={barId}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={tokens.muted}
          maxLength={maxLength}
          accessibilityLabel={unit ? `${label}, ${unit}` : label}
          accessibilityHint={problem ?? undefined}
          style={[
            styles.input,
            wide ? styles.inputWide : null,
            {
              color: tokens.ink,
              backgroundColor: tokens.ground,
              borderColor: problem ? tokens.danger : tokens.hair,
              borderWidth: problem ? 1.5 : StyleSheet.hairlineWidth,
            },
          ]}
        />
        {unit ? (
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[TYPE.subhead, styles.unit, { color: tokens.muted }]}
          >
            {unit}
          </Text>
        ) : null}
      </View>
      {problem ? (
        <Text
          accessibilityRole="alert"
          testID={testID ? `${testID}-problem` : undefined}
          style={[TYPE.footnote, { color: tokens.danger }]}
        >
          {problem}
        </Text>
      ) : null}
    </View>
    </View>
  )
})

const styles = StyleSheet.create({
  inset: { paddingLeft: SPACE[4] },
  wrap: { paddingVertical: SPACE[2], paddingRight: SPACE[4], gap: SPACE[1] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE[3],
    minHeight: 44,
  },
  text: { flex: 1, gap: 2 },
  input: {
    ...TYPE.body,
    ...TABULAR,
    width: 110,
    textAlign: 'right',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  inputWide: { width: 170, textAlign: 'left' },
  unit: { minWidth: 48 },
})
