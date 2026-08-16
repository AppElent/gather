import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useI18n } from '../../../src/i18n'
import { useTokens } from '../../../src/theme/tokens'

/** Search has a permanent destination, while its data and empty state await their spike. */
export default function SearchTab() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { t } = useI18n()

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: tokens.fg }]}
        >
          {t.shell.search.title}
        </Text>
        <Text style={[styles.description, { color: tokens.muted }]}>
          {t.shell.search.deferred}
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  heading: { gap: 7 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  description: { fontSize: 15, lineHeight: 22 },
})
