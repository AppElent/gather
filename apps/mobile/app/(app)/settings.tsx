/**
 * Settings: the preferences that are about you rather than about a Group.
 *
 * It sits above the tabs in the root stack, so it gets the platform's push,
 * its header and its back gesture, and the fixed five are untouched by its
 * existence (ADR-0015, #164). Nothing here is Group-scoped — a Member reads the
 * same appearance and the same language in every household they are in — which
 * is exactly why it is not a tab and not inside one.
 *
 * ## Order
 *
 * Language first, for the web's recorded reason: it is the setting that changes
 * the words of every other setting on this page, including its own. Appearance
 * second. The two rows out — Account and Groups — last, because they are not
 * settings at all; they are the rest of the utility stack, reached from the one
 * place somebody already opens when they are looking for something that is not
 * a Module.
 *
 * ## Both controls keep working when Gather cannot be reached
 *
 * Neither reads or writes anything over the network: the choice goes into the
 * phone's own store and is read back before the first frame (#159, user story
 * 21). That is the whole reason `AppearanceProvider` and `LocaleProvider` sit
 * outside Clerk and Convex in the root layout.
 */
import { router } from 'expo-router'
import { ScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAvailability } from '../../src/availability/AvailabilityProvider'
import { Segmented } from '../../src/components/Segmented'
import { SettingsCard, SettingsRow } from '../../src/components/SettingsCard'
import { fmt, SUPPORTED_LOCALES, useI18n } from '../../src/i18n'
import {
  APPEARANCE_PREFERENCES,
  useAppearance,
} from '../../src/theme/appearance'
import { useTokens } from '../../src/theme/tokens'

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
        {/* Each language is written in itself. "Dutch" is only useful to
            somebody who already reads English — exactly the reader this
            control is not for. */}
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
            // "Light" on its own is a word, not a choice. The spoken name says
            // which setting it belongs to.
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
          onPress={() => router.push('/account')}
        />
        <SettingsRow
          label={text.groups}
          disabled={!serviceActionsEnabled}
          onPress={() => router.push('/groups')}
        />
      </SettingsCard>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
})
