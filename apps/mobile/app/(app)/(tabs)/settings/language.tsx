/**
 * The language Gather's own words are in — not the language of what is in it.
 * That distinction is the whole of the description, and it is the web's own
 * sentence (ADR-0011), so it says the same thing on both clients.
 */
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Segmented } from '../../../../src/components/Segmented'
import { SUPPORTED_LOCALES, useI18n } from '../../../../src/i18n'
import { useTokens } from '../../../../src/theme/tokens'

export default function Language() {
  const tokens = useTokens()
  const { t, locale, setLocale } = useI18n()
  const insets = useSafeAreaInsets()
  const text = t.settings.language

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Segmented
        value={locale}
        onChange={setLocale}
        options={SUPPORTED_LOCALES.map((option) => ({
          value: option,
          label: text.names[option],
        }))}
      />
      <Text style={[styles.description, { color: tokens.muted }]}>
        {text.description}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  description: { fontSize: 14, lineHeight: 20 },
})
