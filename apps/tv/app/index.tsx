import { resolveLocale, SUPPORTED_LOCALES } from '@gather/core/i18n'
import { en, nl } from '@gather/core/messages'
import { getFunctionName } from 'convex/server'
import { useLocales } from 'expo-localization'
import { StyleSheet, Text, useColorScheme, View } from 'react-native'
import { api } from '../src/convex/api'

const MESSAGES = { en, nl }

/** The neutrals of `apps/mobile/src/theme/palette.ts` this screen uses. */
const COLORS = {
  light: { ground: '#F2F3F1', ink: '#1A1F1D', muted: '#5E6764' },
  dark: { ground: '#0F1110', ink: '#F1F3F1', muted: '#A0A8A4' },
}

/**
 * Placeholder until sign-in and the dashboard land (APP-641). Development
 * builds also name a Convex function, which shows the generated API is bundled.
 */
export default function Placeholder() {
  const requested = useLocales()
    .map((locale) => locale.languageTag)
    .join(',')
  const { publicFrame } =
    MESSAGES[resolveLocale(SUPPORTED_LOCALES, 'en', undefined, requested)].shell
  const colors = COLORS[useColorScheme() === 'light' ? 'light' : 'dark']
  return (
    <View style={[styles.root, { backgroundColor: colors.ground }]}>
      <Text style={[styles.brand, { color: colors.ink }]}>
        {publicFrame.brand}
      </Text>
      <Text style={[styles.tagline, { color: colors.muted }]}>
        {publicFrame.tagline}
      </Text>
      {__DEV__ ? (
        <Text style={[styles.debug, { color: colors.muted }]}>
          {getFunctionName(api.mealPlan.week)}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  brand: { fontSize: 96, fontWeight: '700' },
  tagline: { fontSize: 40 },
  debug: { fontSize: 28 },
})
