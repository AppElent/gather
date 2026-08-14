/**
 * The three things you can do from the front door, in the order they deserve.
 *
 * Sign in is ink and solid; creating an account is outlined. Both are real
 * destinations rather than sheets, because the reset flow has to come off the
 * sign-in screen and a sheet that pushes three more sheets is a stack wearing a
 * disguise.
 *
 * The dev shortcut sits below both, separated by a rule, and says on its face
 * that it is not for you — see `src/auth/config.ts` for why the gate is the
 * publishable key's prefix and not `__DEV__`. It is `null` in every build that
 * points at a live instance, so this file renders nothing extra there.
 */

import { useRouter } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { devLogin } from '../auth/config'
import { usePasswordSignIn } from '../auth/usePasswordSignIn'
import { useI18n } from '../i18n'
import { useTokens } from '../theme/tokens'
import { AuthButton } from './AuthButton'
import { AuthError } from './AuthError'

export function WelcomeActions() {
  const router = useRouter()
  const tokens = useTokens()
  const { t } = useI18n()
  const { submit, busy, error } = usePasswordSignIn()

  // Bound locally: TypeScript will not carry the null-check on an imported
  // binding into the callback below.
  const shortcut = devLogin

  return (
    <View style={styles.wrap}>
      <AuthError message={error} />

      <AuthButton
        label={t.welcome.signIn}
        onPress={() => router.push('/sign-in')}
      />
      <AuthButton
        variant="secondary"
        label={t.welcome.createAccount}
        onPress={() => router.push('/sign-up')}
      />

      {shortcut ? (
        <View style={styles.dev}>
          <View style={[styles.rule, { backgroundColor: tokens.border }]} />
          <View style={styles.devRow}>
            <View style={[styles.badge, { borderColor: tokens.border }]}>
              <Text style={[styles.badgeText, { color: tokens.muted }]}>
                {t.welcome.devBadge}
              </Text>
            </View>
            <AuthButton
              variant="ghost"
              busy={busy}
              label={t.welcome.devSignIn}
              onPress={() => submit(shortcut.email, shortcut.password)}
              style={styles.devButton}
            />
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  dev: { marginTop: 6, gap: 4 },
  rule: { height: StyleSheet.hairlineWidth, marginBottom: 6 },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devButton: { paddingHorizontal: 10 },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
})
