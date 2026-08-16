import { router } from 'expo-router'
import { ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAvailability } from '../../../../src/availability/AvailabilityProvider'
import { Segmented } from '../../../../src/components/Segmented'
import {
  SettingsCard,
  SettingsRow,
} from '../../../../src/components/SettingsCard'
import { fmt, SUPPORTED_LOCALES, useI18n } from '../../../../src/i18n'
import {
  APPEARANCE_PREFERENCES,
  useAppearance,
} from '../../../../src/theme/appearance'
import { useTokens } from '../../../../src/theme/tokens'

export default function Settings() {
  const tokens = useTokens()
  const { t, locale, setLocale } = useI18n()
  const { preference, setPreference } = useAppearance()
  const { serviceActionsEnabled } = useAvailability()
  const insets = useSafeAreaInsets()
  const text = t.settings

  return (
    <ScrollView
      style={{ backgroundColor: tokens.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 24 },
      ]}
    >
      <SettingsCard
        title={text.language.title}
        description={text.language.description}
      >
        <Segmented
          value={locale}
          onChange={setLocale}
          options={SUPPORTED_LOCALES.map((option) => ({
            value: option,
            label: text.language.names[option],
          }))}
        />
      </SettingsCard>
      <SettingsCard
        title={text.appearance.title}
        description={text.appearance.description}
      >
        <Segmented
          value={preference}
          onChange={setPreference}
          options={APPEARANCE_PREFERENCES.map((option) => ({
            value: option,
            label: text.appearance.modes[option],
            accessibilityLabel: fmt(text.appearance.choose, {
              mode: text.appearance.modes[option],
            }),
          }))}
        />
      </SettingsCard>
      <SettingsCard>
        <SettingsRow
          label={text.account}
          disabled={!serviceActionsEnabled}
          onPress={() => router.push('/profile/account')}
        />
        <SettingsRow
          label={text.groups}
          disabled={!serviceActionsEnabled}
          onPress={() => router.push('/profile/groups')}
        />
      </SettingsCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
})
