/**
 * The addresses on the account — read-only, and saying so.
 *
 * Adding one is a verification round trip with its own screen, its own code
 * field and its own failure modes, and none of that is what issue #208 asked
 * for. What it is not is a text field that looks editable: the screen this
 * replaces said "managed on the web" about the whole account, and the reason
 * that was worth deleting is that it was untrue about the name and the
 * password — not about this.
 *
 * So the list is the content, and the sentence under it is the honest half of
 * the old one.
 */
import { useUser } from '@clerk/expo'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SettingsCard } from '../../../../../src/components/SettingsCard'
import { useI18n } from '../../../../../src/i18n'
import { useTokens } from '../../../../../src/theme/tokens'

export default function Emails() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { user } = useUser()
  const insets = useSafeAreaInsets()

  const addresses = user?.emailAddresses ?? []

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <SettingsCard description={t.account.emails.description}>
        {addresses.map((address, index) => {
          const tags = [
            address.id === user?.primaryEmailAddressId
              ? t.account.emails.primary
              : null,
            address.verification?.status === 'verified'
              ? null
              : t.account.emails.unverified,
          ].filter(Boolean)

          return (
            <View
              key={address.id}
              style={[
                styles.row,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: tokens.border,
                },
              ]}
            >
              <Text selectable style={[styles.address, { color: tokens.fg }]}>
                {address.emailAddress}
              </Text>
              {tags.length ? (
                <Text style={[styles.tags, { color: tokens.muted }]}>
                  {tags.join(' · ')}
                </Text>
              ) : null}
            </View>
          )
        })}
      </SettingsCard>

      <Text style={[styles.note, { color: tokens.muted }]}>
        {t.account.emails.addOnWeb}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  row: { paddingVertical: 8, gap: 2 },
  address: { fontSize: 16 },
  tags: { fontSize: 13 },
  note: { fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
})
