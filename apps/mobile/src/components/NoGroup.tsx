/**
 * The one signed-in state with no Group at all.
 *
 * It sits outside anything Group-scoped, because a shell drawn around a Group
 * that does not exist is chrome that leads nowhere (ADR-0015). It is only
 * reached after `GroupProvider`'s grace period, so it means "you are in no
 * Group", never "the list has not arrived".
 *
 * It used to offer no way out but the web, because the phone had no way to make
 * a Group. From #164 it renders the same `GroupForms` the Groups screen does —
 * the same component, not a second create surface to keep in step — so the one
 * screen where somebody has nothing else to do is the one screen that can fix
 * itself. Creating or joining makes `myGroups` non-empty, and the provider
 * replaces this with the shell on the next answer.
 *
 * The scroll view is not decoration: two forms and a keyboard do not fit on a
 * small phone, and a create button under the fold is the same dead end in a
 * different disguise.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useI18n } from '../i18n'
import { useTokens } from '../theme/tokens'
import { useHideSplash } from '../useHideSplash'
import { AuthButton } from './AuthButton'
import { GroupForms } from './GroupForms'

export function NoGroup({ onSignOut }: { onSignOut: () => void }) {
  const tokens = useTokens()
  const { t } = useI18n()
  const insets = useSafeAreaInsets()
  const onLayout = useHideSplash()

  return (
    <ScrollView
      onLayout={onLayout}
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 16 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.body}>
        <Text
          accessibilityRole="header"
          style={[styles.heading, { color: tokens.fg }]}
        >
          {t.group.noneTitle}
        </Text>
        <Text style={[styles.text, { color: tokens.muted }]}>
          {t.group.noneBody}
        </Text>
      </View>

      <GroupForms />

      <AuthButton
        variant="secondary"
        label={t.signedIn.signOut}
        onPress={onSignOut}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, gap: 20 },
  body: { gap: 10 },
  heading: { fontSize: 27, fontWeight: '700', letterSpacing: -0.5 },
  text: { fontSize: 15, lineHeight: 22 },
})
