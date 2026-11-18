/**
 * A labelled text field, the app's one: sign-in, Account and the Group forms
 * all use it.
 *
 * ADR-0017 keeps text inputs as a plain React Native `TextInput` — no wrapper
 * library, no web parity. What that costs is that the platform affordances are
 * ours to remember, so they are props with defaults here rather than something
 * each screen re-derives: `autoComplete` is what makes Android's password
 * manager offer to fill and to save, and `textContentType` is the iOS half of
 * the same deal.
 *
 * Password managers need two more things a screen would otherwise forget:
 *
 * - A new-password field (`textContentType="newPassword"`) passes iOS
 *   `passwordRules`, so the strong password iOS offers passes Clerk. The
 *   default is `CLERK_PASSWORD_RULES`.
 * - iOS AutoFill can set or clear a credential field without `onChangeText`
 *   (declining "Use Strong Password?" clears it silently). A credential field
 *   therefore also hands its native text to `onChangeText` when editing ends
 *   and when the keyboard submits, so state matches what the field shows.
 *   An `onSubmitEditing` that submits the form should read
 *   `event.nativeEvent.text`: the state update has not landed yet.
 *
 * A form's primary button needs more than this, because a focused field has
 * not reported its text yet: `useCredentialFields` handles that.
 */
import { forwardRef, useState } from 'react'
import {
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  View,
} from 'react-native'
import { useI18n } from '../i18n'
import { UI_ICONS } from '../theme/icons'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'

/**
 * iOS `passwordRules` for the Clerk password policy. The development instance
 * sets no minimum (Clerk's default of 8 applies) and no character classes;
 * change this with the instance's password settings.
 */
export const CLERK_PASSWORD_RULES = 'minlength: 8;'

/** Fields a password manager fills, and so can set without `onChangeText`. */
const CREDENTIAL_TYPES = new Set<TextInputProps['textContentType']>([
  'username',
  'password',
  'newPassword',
  'oneTimeCode',
])

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label: string
  /** Renders the reveal toggle and starts obscured. */
  secure?: boolean
  /** Marks the border and is announced with the field. */
  invalid?: boolean
}

export const Field = forwardRef<TextInputInstance, FieldProps>(function Field(
  {
    label,
    secure,
    invalid,
    passwordRules,
    onFocus,
    onBlur,
    onEndEditing,
    onSubmitEditing,
    ...props
  },
  ref,
) {
  const tokens = useTokens()
  const { t } = useI18n()
  const [focused, setFocused] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const credential = secure || CREDENTIAL_TYPES.has(props.textContentType)
  const readOnly = props.editable === false
  /** Hands the native text to `onChangeText` when it differs from `value`. */
  function sync(event: NativeSyntheticEvent<{ text: string }>) {
    const { text } = event.nativeEvent
    if (credential && text !== props.value) props.onChangeText?.(text)
  }

  const Reveal = revealed ? UI_ICONS.EyeOff : UI_ICONS.Eye
  const borderColor = invalid
    ? tokens.danger
    : focused
      ? tokens.ink
      : tokens.hair

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
          style={[
            styles.input,
            { color: readOnly ? tokens.muted : tokens.ink },
          ]}
          placeholderTextColor={tokens.muted}
          secureTextEntry={secure && !revealed}
          accessibilityLabel={label}
          passwordRules={
            passwordRules ??
            (props.textContentType === 'newPassword'
              ? CLERK_PASSWORD_RULES
              : undefined)
          }
          {...props}
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
          onEndEditing={(event) => {
            sync(event)
            onEndEditing?.(event)
          }}
          onSubmitEditing={(event) => {
            sync(event)
            onSubmitEditing?.(event)
          }}
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
})

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { ...TYPE.footnoteStrong, letterSpacing: 0.2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.card,
    paddingHorizontal: 14,
  },
  // A focused field gets a second hairline rather than a glow — a shadow reads
  // as elevation on Android and this is not a raised surface.
  boxFocused: { borderWidth: 1.75, paddingHorizontal: 13.25 },
  input: { ...TYPE.body, flex: 1, paddingVertical: 13 },
  reveal: { paddingLeft: 10, paddingVertical: 8 },
})
