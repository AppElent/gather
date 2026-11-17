/**
 * "Continue with Apple / Microsoft" under the email form, on sign-in and
 * sign-up alike: Clerk decides which one each attempt turns out to be, so the
 * two screens draw the same rows.
 *
 * Apple on iOS is the system `AppleAuthenticationButton`. App Review requires
 * Apple's own artwork and approved styles, so it is not themed like the rest:
 * black on a light screen, white on a dark one, the pill radius and the 52 pt
 * height of `Button` so the column reads as one set. It localizes itself from
 * the device language. Android gets a plain `Button` for Apple, which opens
 * Apple's web sign-in.
 *
 * Microsoft is a `secondary` `Button`, label only. Microsoft's branding guide
 * asks for its four-square mark at a fixed size on a real "Sign in with
 * Microsoft" button; a text label is allowed and avoids drawing it wrong.
 *
 * While one provider is running, the others are inert, so a second tap cannot
 * start a second browser on top of the first.
 */
import * as AppleAuthentication from 'expo-apple-authentication'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { SOCIAL_PROVIDERS, useSocialSignIn } from '../auth/useSocialSignIn'
import { useI18n } from '../i18n'
import { useAppearance } from '../theme/appearance'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'
import { Button } from '../ui/button'
import { AuthError } from './AuthError'

/** `Button`'s own height: 15 pt padding twice plus `TYPE.bodyStrong`'s line. */
const BUTTON_HEIGHT = 52

export function SocialButtons() {
  const tokens = useTokens()
  const { scheme } = useAppearance()
  const { t } = useI18n()
  const { start, pending, error } = useSocialSignIn()

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}>
        <View style={[styles.rule, { backgroundColor: tokens.hair }]} />
        <Text style={[styles.heading, { color: tokens.muted }]}>
          {t.social.heading}
        </Text>
        <View style={[styles.rule, { backgroundColor: tokens.hair }]} />
      </View>

      {SOCIAL_PROVIDERS.map((provider) =>
        provider === 'apple' && Platform.OS === 'ios' ? (
          <View
            key={provider}
            pointerEvents={pending ? 'none' : 'auto'}
            style={pending ? styles.inert : null}
          >
            <AppleAuthentication.AppleAuthenticationButton
              testID="sign-in-apple"
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
              }
              buttonStyle={
                scheme === 'dark'
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={BUTTON_HEIGHT / 2}
              style={styles.apple}
              onPress={() => start(provider)}
            />
          </View>
        ) : (
          <Button
            key={provider}
            testID={`sign-in-${provider}`}
            variant="secondary"
            label={t.social[provider]}
            busy={pending === provider}
            disabled={pending !== null && pending !== provider}
            onPress={() => start(provider)}
          />
        ),
      )}

      <AuthError message={error} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  heading: { ...TYPE.footnoteStrong },
  apple: { height: BUTTON_HEIGHT, width: '100%', borderRadius: RADIUS.pill },
  inert: { opacity: 0.5 },
})
