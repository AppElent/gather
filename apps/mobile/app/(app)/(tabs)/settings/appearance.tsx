/**
 * One setting, one screen.
 *
 * The old Settings screen stacked appearance, language and two rows onto one
 * surface, which worked while there were four of them. The tab's index is that
 * list now, so this is the leaf: the control, and the sentence saying what
 * choosing it actually does. No card title — the header already says the word.
 */
import { ScrollView, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Segmented } from '../../../../src/components/Segmented'
import { fmt, useI18n } from '../../../../src/i18n'
import {
  APPEARANCE_PREFERENCES,
  useAppearance,
} from '../../../../src/theme/appearance'
import { useTokens } from '../../../../src/theme/tokens'

export default function Appearance() {
  const tokens = useTokens()
  const { t } = useI18n()
  const { preference, setPreference } = useAppearance()
  const insets = useSafeAreaInsets()
  const text = t.settings.appearance

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <Segmented
        value={preference}
        onChange={setPreference}
        options={APPEARANCE_PREFERENCES.map((option) => ({
          value: option,
          label: text.modes[option],
          accessibilityLabel: fmt(text.choose, { mode: text.modes[option] }),
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
