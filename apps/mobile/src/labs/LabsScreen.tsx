/**
 * Labs: every prototype this app carries, with the question each one answers.
 *
 * Four things per row, and the last two are what stop the section rotting: the
 * **date** it was built, so a reader can see how stale the question is, and the
 * **verdict**, so a prototype whose argument is over stops being a live
 * question. A row without both is a row nobody can act on in six months.
 *
 * The links go straight to a combination — `?nav=fluid&cell=marks` — because
 * the interesting comparison is usually between two specific mixes and finding
 * them with the switcher every time is friction nobody needs.
 */
import { Link } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { fmt, useI18n } from '../i18n'
import { RADIUS, TYPE, useTokens } from '../theme/tokens'
import { LABS_ENTRIES } from './entries'
import { describeCombination } from './variants'

export function LabsScreen() {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()

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

      {LABS_ENTRIES.map((entry) => (
        <View
          key={entry.id}
          style={[
            styles.card,
            { backgroundColor: tokens.surface, borderColor: tokens.hair },
          ]}
        >
          <Text
            accessibilityRole="header"
            style={[styles.name, { color: tokens.ink }]}
          >
            {t.labs.entries[entry.id]}
          </Text>

          <Text style={[styles.sectionLabel, { color: tokens.muted }]}>
            {t.labs.entry.question}
          </Text>
          <Text style={[styles.body, { color: tokens.ink }]}>
            {t.labs[entry.id].question}
          </Text>

          <Text style={[styles.sectionLabel, { color: tokens.muted }]}>
            {t.labs.entry.verdict}
          </Text>
          <Text style={[styles.body, { color: tokens.muted }]}>
            {entry.verdict === null
              ? t.labs.entry.undecided
              : t.labs[entry.id].verdict}
          </Text>

          <Link
            href={{
              pathname: '/settings/labs/calendar',
              params: { production: 'true' },
            }}
            accessibilityLabel={t.labs.calendar.productionPreview}
            style={[
              styles.link,
              { borderColor: tokens.hair, color: tokens.ink },
            ]}
          >
            {t.labs.calendar.productionPreview}
          </Link>

          <Text style={[styles.sectionLabel, { color: tokens.muted }]}>
            {t.labs.entry.variants}
          </Text>
          <View style={styles.links}>
            {entry.links.map((link) => {
              const label = describeCombination(Object.entries(link.params))
              return (
                <Link
                  key={label}
                  testID={`labs-open-${entry.id}-${Object.values(link.params).join('-')}`}
                  href={{ pathname: entry.href, params: link.params }}
                  accessibilityLabel={`${t.labs.entry.open}: ${label}`}
                  style={[
                    styles.link,
                    { borderColor: tokens.hair, color: tokens.ink },
                  ]}
                >
                  {label}
                </Link>
              )
            })}
          </View>

          <Text style={[styles.built, { color: tokens.muted }]}>
            {fmt(t.labs.entry.built, {
              date: new Date(entry.built).toLocaleDateString(locale, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }),
            })}
          </Text>
        </View>
      ))}
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
  sectionLabel: {
    ...TYPE.footnoteStrong,
    marginTop: 10,
  },
  body: { ...TYPE.subhead },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  link: {
    ...TYPE.footnoteStrong,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    overflow: 'hidden',
  },
  built: { ...TYPE.footnote, marginTop: 12 },
})
