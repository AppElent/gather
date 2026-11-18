/**
 * Labs: the unfinished tools a development build carries.
 *
 * One card per lab, each with what it holds and a link into it. Today that is
 * the Finance lab alone; the Calendar prototype that used to sit here was
 * removed once the real Calendar shipped (APP-342).
 */
import { Link } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useI18n } from '../i18n'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'

export function LabsScreen() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { t } = useI18n()

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: tokens.ground }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 32 },
      ]}
    >
      <Text style={[styles.intro, { color: tokens.muted }]}>
        {t.labs.description}
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: tokens.surface, borderColor: tokens.hair },
        ]}
      >
        <Text
          accessibilityRole="header"
          style={[styles.name, { color: tokens.ink }]}
        >
          {t.labs.finance.title}
        </Text>
        <Text style={[styles.body, { color: tokens.muted }]}>
          {t.labs.finance.description}
        </Text>
        <Link
          href="/settings/labs/finance"
          accessibilityLabel={t.labs.finance.open}
          style={[
            styles.link,
            { borderColor: tokens.hair, color: tokens.ink },
          ]}
        >
          {t.labs.finance.open}
        </Link>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  intro: { ...TYPE.footnote },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.card,
    padding: 14,
    gap: 4,
  },
  name: { ...TYPE.bodyStrong, letterSpacing: -0.3 },
  body: { ...TYPE.subhead },
  link: {
    ...TYPE.footnoteStrong,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    overflow: 'hidden',
  },
})
