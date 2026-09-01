/**
 * The one bordered search row, for the screens that filter a list in place.
 *
 * Search itself does not use this — a whole screen of search is `Stack.SearchBar`,
 * which the platform draws. This is the other case: a control sitting above a
 * collection, where there was no native answer and five near-copies grew instead.
 *
 * The clear affordance is the reason it is worth having. `clearButtonMode` is
 * iOS-only, so every copy of this field left Android with no way to empty a
 * query that returned hits. Here iOS gets the native button and everything
 * else gets a real one — never both.
 */

import type { StyleProp, TextInputProps, ViewStyle } from 'react-native'
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'

import { UI_ICONS } from '../theme/icons'
import { RADIUS, useTokens } from '../theme/tokens'

export function SearchField({
  value,
  onChangeText,
  placeholder,
  testID,
  onSubmitEditing,
  autoFocus,
  tone = 'surface',
  style,
  clearAccessibilityLabel,
}: {
  value: string
  onChangeText: (next: string) => void
  placeholder: string
  testID?: string
  onSubmitEditing?: TextInputProps['onSubmitEditing']
  autoFocus?: boolean
  /**
   * `inset` for a field on a sheet, whose ground is already `surface` — the
   * default would render the field invisible against it.
   */
  tone?: 'surface' | 'inset'
  style?: StyleProp<ViewStyle>
  /** Names the explicit clear button, where the platform has no native one. */
  clearAccessibilityLabel?: string
}) {
  const tokens = useTokens()
  const Search = UI_ICONS.Search
  const X = UI_ICONS.X
  const nativeClear = Platform.OS === 'ios'

  return (
    <View
      style={[
        styles.field,
        {
          backgroundColor: tone === 'inset' ? tokens.bg : tokens.surface,
          borderColor: tokens.border,
        },
        style,
      ]}
    >
      <Search
        size={18}
        color={tokens.muted}
        strokeWidth={2}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <TextInput
        testID={testID}
        autoFocus={autoFocus}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={tokens.muted}
        accessibilityLabel={placeholder}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode={nativeClear ? 'while-editing' : 'never'}
        style={[styles.input, { color: tokens.fg }]}
      />
      {!nativeClear && value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={clearAccessibilityLabel ?? placeholder}
          testID={testID ? `${testID}-clear` : undefined}
          hitSlop={10}
          onPress={() => onChangeText('')}
        >
          <X size={17} color={tokens.muted} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 9 },
})
