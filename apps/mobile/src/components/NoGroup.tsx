/**
 * The one signed-in state with no Group at all.
 *
 * It sits outside anything Group-scoped, because a shell drawn around a Group
 * that does not exist is chrome that leads nowhere (ADR-0015). It is only
 * reached after `GroupProvider`'s grace period, so it means "you are in no
 * Group", never "the list has not arrived".
 *
 * It offers no way out yet, on purpose: creating and joining a Group on the
 * phone is #164's, and inventing a second create surface here would be a
 * second thing to keep in step with it. What it does instead is say what has
 * happened and name the one place that can currently fix it.
 */
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useI18n } from '../i18n'
import { useTokens } from '../theme/tokens'
import { useHideSplash } from '../useHideSplash'
import { AuthButton } from './AuthButton'

export function NoGroup({ onSignOut }: { onSignOut: () => void }) {
  const tokens = useTokens()
  const { t } = useI18n()
  const onLayout = useHideSplash()

  return (
    <SafeAreaView
      onLayout={onLayout}
      style={[styles.wrap, { backgroundColor: tokens.bg }]}
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

      <AuthButton
        variant="secondary"
        label={t.signedIn.signOut}
        onPress={onSignOut}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, paddingBottom: 12 },
  body: { flex: 1, justifyContent: 'center', gap: 10 },
  heading: { fontSize: 27, fontWeight: '700', letterSpacing: -0.5 },
  text: { fontSize: 15, lineHeight: 22 },
})
