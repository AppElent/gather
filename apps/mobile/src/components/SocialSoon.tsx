/**
 * Apple, Microsoft and Google — placed, named, and honestly marked as not here
 * yet.
 *
 * The Clerk instance has `socialProviders: []` (#139), so there is nothing to
 * call and these rows are `disabled` rather than wired to a handler that fails.
 * A control that looks live and does nothing is the one outcome worse than a
 * control that says "Soon", and `accessibilityState.disabled` means a screen
 * reader is told the same thing sighted users are.
 *
 * **No brand marks.** lucide dropped its brand icons, and Apple's, Google's and
 * Microsoft's sign-in buttons each come with mandatory asset and layout rules
 * that a greyed-out placeholder cannot satisfy anyway. Drawing an approximate
 * Apple logo would be worse than drawing none. The real marks arrive with the
 * ticket that makes the buttons work.
 *
 * `soon` is the web's word (`shell.marks.soon` / "Binnenkort"), deliberately:
 * gather already has a vocabulary for "staged but not built" and this is it.
 */
import { StyleSheet, Text, View } from 'react-native'
import { fmt, useI18n } from '../i18n'
import { RADIUS, useTokens } from '../theme/tokens'

const PROVIDERS = ['apple', 'microsoft', 'google'] as const

export function SocialSoon() {
  const tokens = useTokens()
  const { t } = useI18n()

  return (
    <View style={styles.wrap}>
      <View style={styles.headingRow}>
        <View style={[styles.rule, { backgroundColor: tokens.border }]} />
        <Text style={[styles.heading, { color: tokens.muted }]}>
          {t.social.heading}
        </Text>
        <View style={[styles.rule, { backgroundColor: tokens.border }]} />
      </View>

      {PROVIDERS.map((provider) => (
        <View
          key={provider}
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel={fmt(t.social.unavailable, {
            provider: t.social[provider],
          })}
          style={[
            styles.row,
            { borderColor: tokens.border, backgroundColor: tokens.surface },
          ]}
        >
          <Text style={[styles.label, { color: tokens.muted }]}>
            {t.social[provider]}
          </Text>
          <View style={[styles.badge, { borderColor: tokens.border }]}>
            <Text style={[styles.badgeText, { color: tokens.muted }]}>
              {t.social.soon}
            </Text>
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  heading: { fontSize: 12.5, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: RADIUS.control,
    paddingVertical: 13,
    paddingHorizontal: 16,
    // Half-strength, so the row reads as staged at a glance and not merely quiet.
    opacity: 0.62,
  },
  label: { fontSize: 15.5, fontWeight: '600' },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
  },
  badgeText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3 },
})
