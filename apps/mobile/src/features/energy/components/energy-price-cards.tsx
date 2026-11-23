/**
 * Home's two price cards (APP-493, designs/energy section 1): what power
 * costs this hour, and today's hours, which open Prices. The words come from
 * `@gather/core/energy-present`, so the web says the same.
 */
import {
  type EnergyPriceDay,
  type EnergyPriceView,
  energyPriceChart,
  energyPriceNow,
} from '@gather/core/energy-present'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useI18n } from '../../../i18n'
import { UI_ICONS } from '../../../theme/icons'
import {
  NUMERAL_XL_MAX_SCALE,
  RADIUS,
  SPACE,
  TYPE,
  useTokens,
} from '../../../theme/tokens'
import { EnergyPriceBars } from './energy-price-bars'

export function EnergyPriceNowCard({
  view,
  now,
}: {
  view: EnergyPriceView
  now: number
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const shown = energyPriceNow(view, now, t.energy, locale)
  if (!shown) return null
  return (
    <View
      testID="energy-price-now"
      accessible
      accessibilityLabel={shown.label}
      style={[styles.now, { backgroundColor: tokens.tintOf('home').wash }]}
    >
      <Text style={[TYPE.subhead, { color: tokens.muted }]}>{shown.caption}</Text>
      <View style={styles.line}>
        <Text
          maxFontSizeMultiplier={NUMERAL_XL_MAX_SCALE}
          style={[TYPE.numeralXl, { color: tokens.ink }]}
        >
          {shown.price}
        </Text>
        <Text style={[TYPE.body, { color: tokens.muted }]}>{shown.unit}</Text>
      </View>
      <Text style={[TYPE.subhead, { color: tokens.ink }]}>
        <Text style={styles.strong}>{shown.judgement}</Text>
        {shown.comparison.slice(shown.judgement.length)}
      </Text>
      {shown.next ? (
        <Text style={[TYPE.subhead, { color: tokens.ink }]}>{shown.next}</Text>
      ) : null}
    </View>
  )
}

export function EnergyPriceTodayCard({
  prices,
  now,
  onPress,
}: {
  prices: EnergyPriceDay
  now: number
  onPress: () => void
}) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const words = t.energy
  const chart = energyPriceChart(prices, now, words, locale)
  if (!chart) return null
  return (
    <Pressable
      testID="energy-price-card"
      accessibilityRole="button"
      accessibilityLabel={`${words.home.priceCard}. ${chart.sentence}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? tokens.surface2 : tokens.surface },
      ]}
    >
      <View style={styles.head}>
        <Text style={[TYPE.bodyStrong, styles.flex, { color: tokens.ink }]}>
          {words.home.priceCard}
        </Text>
        <View style={styles.link}>
          <Text style={[TYPE.footnote, { color: tokens.muted }]}>
            {words.home.openPrices}
          </Text>
          <UI_ICONS.ChevronRight size={14} color={tokens.muted} strokeWidth={2.6} />
        </View>
      </View>
      <EnergyPriceBars
        testID="energy-home-prices"
        bars={chart.bars}
        height={96}
        highlight={false}
        label={chart.sentence}
      />
      <Text style={[TYPE.subhead, { color: tokens.ink }]}>{chart.sentence}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  now: { borderRadius: RADIUS.now, padding: SPACE[4], gap: 6 },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: SPACE[2],
  },
  strong: { fontWeight: '700' },
  card: {
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACE[4],
    paddingTop: 14,
    paddingBottom: SPACE[3],
    gap: SPACE[2],
  },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE[2] },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  flex: { flex: 1 },
})
