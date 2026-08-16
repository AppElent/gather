/**
 * The front door — direction A, "words plus a tinted strip".
 *
 * The pitch leads, in the same two sentences the web's About page uses, and the
 * catalogue confirms it underneath as a band of tinted chips. The claim is
 * "thirteen Modules, one Group"; a list of thirteen names in their four group
 * tints is that claim rather than an illustration of it.
 *
 * The chips are not tappable and are not meant to look it. There is nothing
 * behind them until you are signed in, and a tile that invites a tap it cannot
 * honour is a worse first impression than a tile that plainly does not.
 *
 * The accent here is ink, not a tint (ADR-0017): the front door belongs to no
 * Module, and a teal Sign in would be claiming you had already arrived
 * somewhere.
 *
 * Direction B lives in `welcome-catalogue.tsx`, unreachable from here on
 * purpose. One of the two is deleted once #147 is settled.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { CatalogueStrip } from '../../src/components/Catalogue'
import { WelcomeActions } from '../../src/components/WelcomeActions'
import { useI18n } from '../../src/i18n'
import { useTokens } from '../../src/theme/tokens'
import { useHideSplash } from '../../src/useHideSplash'

export default function Welcome() {
  const tokens = useTokens()
  const { t } = useI18n()
  const onLayout = useHideSplash()

  return (
    <SafeAreaView
      onLayout={onLayout}
      style={[styles.flex, { backgroundColor: tokens.bg }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pitch}>
          <Text style={[styles.brand, { color: tokens.fg }]}>{t.brand}</Text>
          <Text style={[styles.tagline, { color: tokens.muted }]}>
            {t.welcome.tagline}
          </Text>

          <Text
            accessibilityRole="header"
            style={[styles.title, { color: tokens.fg }]}
          >
            {t.welcome.title}
          </Text>
          <Text style={[styles.subtitle, { color: tokens.muted }]}>
            {t.welcome.subtitle}
          </Text>
        </View>

        <View style={styles.catalogue}>
          <Text style={[styles.eyebrow, { color: tokens.muted }]}>
            {t.welcome.catalogueHeading}
          </Text>
          <CatalogueStrip />
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <WelcomeActions />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    // Slack collects above the pitch, not between the pitch and the actions:
    // the words and the catalogue are one block, and the buttons answer them.
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    gap: 30,
  },
  pitch: { gap: 6 },
  brand: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  tagline: { fontSize: 15, marginBottom: 18 },
  title: {
    fontSize: 27,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 6 },
  catalogue: { gap: 12 },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  actions: { paddingHorizontal: 24, paddingBottom: 12 },
})
