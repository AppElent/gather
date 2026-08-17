import { useUser } from '@clerk/expo'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSignOut } from '../../../../src/auth/useSignOut'
import { useAvailability } from '../../../../src/availability/AvailabilityProvider'
import { AuthButton } from '../../../../src/components/AuthButton'
import { SettingsCard } from '../../../../src/components/SettingsCard'
import { useI18n } from '../../../../src/i18n'
import { useTokens } from '../../../../src/theme/tokens'

export default function Account() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { user } = useUser()
  const signOut = useSignOut()
  const { serviceActionsEnabled } = useAvailability()
  const insets = useSafeAreaInsets()
  const email = user?.primaryEmailAddress?.emailAddress ?? ''
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
            <Text selectable style={[styles.name, { color: tokens.fg }]}>
              {name}
            </Text>
          ) : null}
          <Text selectable style={[styles.email, { color: tokens.muted }]}>
            {email}
          </Text>
        </View>
      </SettingsCard>
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
