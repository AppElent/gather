/**
 * Who you are on this phone, and the way out of it.
 *
 * Both used to sit in a footer on Home, where they were the only way to leave a
 * shell that had nowhere else to put them. They have somewhere now, and Home is
 * back to being about the Group.
 *
 * Read-only on purpose. Clerk's Expo SDK can change a name or a password from
 * here, but #159 keeps mobile v1 to the shell, and a screen that looks editable
 * and is not would be worse than one that says where the editing happens.
 *
 * Sign-out goes through `useSignOut` rather than Clerk's `signOut` directly:
 * leaving is one more thing than ending the session — the retained Group has to
 * be forgotten so the next person to sign in on this phone lands in their own.
 */
import { useUser } from '@clerk/expo'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAvailability } from '../../src/availability/AvailabilityProvider'
import { useSignOut } from '../../src/auth/useSignOut'
import { AuthButton } from '../../src/components/AuthButton'
import { SettingsCard } from '../../src/components/SettingsCard'
import { useI18n } from '../../src/i18n'
import { useTokens } from '../../src/theme/tokens'

export default function Account() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { user } = useUser()
  const signOut = useSignOut()
  const { serviceActionsEnabled } = useAvailability()
  const insets = useSafeAreaInsets()

  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  // A Clerk account can have no name at all — the sign-up flow here only ever
  // asks for an email — so the address is the identity and the name is the
  // extra, not the other way round.
  const name = user?.fullName?.trim()

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <SettingsCard>
        <View style={styles.identity}>
          {name ? (
            <Text style={[styles.name, { color: tokens.fg }]}>{name}</Text>
          ) : null}
          <Text selectable style={[styles.email, { color: tokens.muted }]}>
            {email}
          </Text>
        </View>
      </SettingsCard>

      {/* Under the card rather than in it: it is a note about the card above,
          not another thing the account has. */}
      <Text style={[styles.note, { color: tokens.muted }]}>
        {t.account.managedOnWeb}
      </Text>

      <AuthButton
        variant="secondary"
        label={t.signedIn.signOut}
        disabled={!serviceActionsEnabled}
        onPress={signOut}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  identity: { gap: 2 },
  name: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  email: { fontSize: 15 },
  note: { fontSize: 14, lineHeight: 20 },
})
