/**
 * What a tab looks like before its Module has a phone version.
 *
 * The shell is the deliverable here, not the Modules in it: v1 supplies
 * placeholders for Recipes, Tasks and Nutrition on purpose, so the navigation
 * can be accepted on a device before any of them is built natively. This is the
 * plainest honest thing a tab can say in the meantime — it does not pretend the
 * Module is missing from Gather, and it does not pretend it is here.
 *
 * #163 replaces it with the real placeholder, which wears its Module's tint and
 * is reached from the catalogue as well as from a tab. Deleted in that change.
 */
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTokens } from '../theme/tokens'

export interface ShellStubProps {
  title: string
  body: string
}

export function ShellStub({ title, body }: ShellStubProps) {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: tokens.fg }]}
      >
        {title}
      </Text>
      <Text style={[styles.body, { color: tokens.muted }]}>{body}</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 8 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  body: { fontSize: 15, lineHeight: 22 },
})
