/**
 * A labelled text field.
 *
 * ADR-0017 keeps auth inputs as a plain React Native `TextInput` — no wrapper
 * library, no web parity. What that costs is that the platform affordances are
 * ours to remember, so they are props with defaults here rather than something
 * each screen re-derives: `autoComplete` is what makes Android's password
 * manager offer to fill and to save, and `textContentType` is the iOS half of
 * the same deal.
 */
import { forwardRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native'
import { useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { RADIUS, useTokens } from '../theme/tokens'

interface AuthFieldProps extends Omit<TextInputProps, 'style'> {
  label: string
  /** Renders the reveal toggle and starts obscured. */
  secure?: boolean
  /** Marks the border and is announced with the field. */
  invalid?: boolean
}

export const AuthField = forwardRef<TextInput, AuthFieldProps>(
  function AuthField({ label, secure, invalid, ...props }, ref) {
    const tokens = useTokens()
    const { t } = useI18n()
    const [focused, setFocused] = useState(false)
    const [revealed, setRevealed] = useState(false)

    const Reveal = revealed ? UI_ICONS.EyeOff : UI_ICONS.Eye
    const borderColor = invalid
      ? tokens.danger
      : focused
        ? tokens.fg
        : tokens.border

    return (
      <View style={styles.wrap}>
        <Text style={[styles.label, { color: tokens.muted }]}>{label}</Text>
        <View
          style={[
            styles.box,
            { borderColor, backgroundColor: tokens.surface },
            focused && styles.boxFocused,
          ]}
        >
          <TextInput
            ref={ref}
            style={[styles.input, { color: tokens.fg }]}
            placeholderTextColor={tokens.muted}
            secureTextEntry={secure && !revealed}
            accessibilityLabel={label}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...props}
          />
          {secure ? (
            <Pressable
              onPress={() => setRevealed((r) => !r)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={
                revealed ? t.fields.hidePassword : t.fields.showPassword
              }
              style={styles.reveal}
            >
              <Reveal size={19} color={tokens.muted} strokeWidth={1.75} />
            </Pressable>
          ) : null}
        </View>
      </View>
    )
  },
)

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.control,
    paddingHorizontal: 14,
  },
  // A focused field gets a second hairline rather than a glow — a shadow reads
  // as elevation on Android and this is not a raised surface.
  boxFocused: { borderWidth: 1.75, paddingHorizontal: 13.25 },
  input: { flex: 1, paddingVertical: 13, fontSize: 16 },
  reveal: { paddingLeft: 10, paddingVertical: 8 },
})
