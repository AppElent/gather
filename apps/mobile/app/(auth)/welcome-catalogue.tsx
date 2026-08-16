/**
 * The front door — direction B, "the catalogue is the hero".
 *
 * The comparison direction for #147. Same words, same actions, opposite
 * emphasis: thirteen tinted tiles carry the top of the screen and the pitch
 * shrinks to a caption underneath them. Where direction A tells you what gather
 * is and shows you the range as evidence, this one shows you the range and lets
 * the sentence explain it.
 *
 * Nothing links here. It is reached by deep link — `gather://welcome-catalogue`
 * — precisely so that adding it does not put a variant-switcher on the screen
 * being judged. **This file is deleted when the direction is chosen**, along
 * with whichever of `CatalogueGrid` / `CatalogueStrip` loses.
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { CatalogueGrid } from '../../src/components/Catalogue'
import { WelcomeActions } from '../../src/components/WelcomeActions'
import { useI18n } from '../../src/i18n'
import { useTokens } from '../../src/theme/tokens'
import { useHideSplash } from '../../src/useHideSplash'

export default function WelcomeCatalogue() {
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
        <View style={styles.head}>
          <Text style={[styles.brand, { color: tokens.fg }]}>{t.brand}</Text>
          <Text style={[styles.tagline, { color: tokens.muted }]}>
            {t.welcome.tagline}
          </Text>
        </View>

        <CatalogueGrid />

        <View style={styles.pitch}>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 22,
  },
  head: { gap: 3 },
  brand: { fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  tagline: { fontSize: 14.5 },
  pitch: { gap: 6 },
  title: {
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  subtitle: { fontSize: 14.5, lineHeight: 21 },
  actions: { paddingHorizontal: 24, paddingBottom: 12 },
})
