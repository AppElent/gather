/**
 * Prices per hour, today and tomorrow (APP-493, designs/energy section 3):
 * the hours, the cheapest three, what makes up the price now, and where it
 * comes from.
 */
import { amsterdamDayOf } from '@gather/core/energy'
import {
  type EnergyPriceBuildUp,
  type EnergyPriceView,
  energyNegativeCards,
  energyPriceBasisNote,
  energyPriceBuildUp,
  energyPriceCaption,
  energyPriceChart,
  energyPriceSourceName,
  energyPriceStateLine,
  energyTomorrowLine,
  formatEnergyPrice,
} from '@gather/core/energy-present'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { Segmented } from '../../components/Segmented'
import { api } from '../../convex/api'
import { useQuery } from '../../convex/queries'
import { useGroup } from '../../group/GroupProvider'
import { fmt, useI18n } from '../../i18n'
import { moduleHref } from '../../modules/moduleDestination'
import { RADIUS, SPACE, TABULAR, TYPE, useTokens } from '../../theme/tokens'
import { Card } from '../../ui/card'
import { InsetList, InsetRow } from '../../ui/inset-list'
import { moduleTile } from '../../ui/module-tile'
import { washScreenOptions } from '../../ui/screen-header'
import { WashHeader } from '../../ui/wash-header'
import { EnergyChartLegend } from './components/energy-mirror-chart'
import { EnergyPriceBars } from './components/energy-price-bars'
import { useEnergyMinute } from './use-energy-minute'

export function EnergyPricesScreen() {
  const tokens = useTokens('home')
  const insets = useSafeAreaInsets()
  const { t, locale } = useI18n()
  const { group } = useGroup()
  const words = t.energy
  const copy = words.prices
  const now = useEnergyMinute()
  const view = useQuery(api.energyPrices.view, {
    groupSlug: group.slug,
    day: amsterdamDayOf(now),
  })
  const tile = moduleTile('energy')
  const current = view?.today
    ? energyPriceChart(view.today, now, words, locale)?.current
    : null

  return (
    <>
      <Stack.Screen options={washScreenOptions(copy.title)} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: tokens.ground }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {tile && view ? (
          <WashHeader
            group={tile.group}
            glyph={tile.glyph}
            summary={{
              count:
                current && view.today
                  ? fmt(
                      view.today.basis === 'allIn' ? copy.now : copy.nowMarket,
                      { price: formatEnergyPrice(current.price, locale) },
                    )
                  : copy.nowNone,
              sub: fmt(copy.source, {
                site: view.siteName,
                source: energyPriceSourceName(view, words),
              }),
            }}
          />
        ) : null}
        <View style={styles.content}>
          {view === undefined ? (
            <LoadingSkeleton rows={4} label={t.actions.loading} />
          ) : view === null ? (
            <Text style={[TYPE.body, { color: tokens.muted }]}>
              {words.empty.summary}
            </Text>
          ) : (
            <Prices view={view} now={now} />
          )}
        </View>
      </ScrollView>
    </>
  )
}

function Prices({ view, now }: { view: EnergyPriceView; now: number }) {
  const tokens = useTokens('home')
  const { t, locale } = useI18n()
  const router = useRouter()
  const words = t.energy
  const copy = words.prices
  const [tab, setTab] = useState<'today' | 'tomorrow'>('today')
  const prices = tab === 'today' ? view.today : view.tomorrow
  const chart = prices
    ? energyPriceChart(prices, tab === 'today' ? now : null, words, locale)
    : null
  const state = energyPriceStateLine(view, now, words, locale)
  const note = prices ? energyPriceBasisNote(view, prices, words) : null
  const buildUp =
    tab === 'today' && prices && chart?.current
      ? energyPriceBuildUp(prices, chart.current, words, locale)
      : null

  return (
    <>
      <Segmented<'today' | 'tomorrow'>
        options={[
          { value: 'today', label: copy.today },
          { value: 'tomorrow', label: copy.tomorrow },
        ]}
        value={tab}
        onChange={setTab}
      />
      {prices && chart ? (
        <>
          <View style={[styles.card, { backgroundColor: tokens.surface }]}>
            <Text
              accessibilityRole="header"
              style={[TYPE.bodyStrong, { color: tokens.ink }]}
            >
              {energyPriceCaption(prices, words, locale)}
            </Text>
            <EnergyPriceBars
              testID="energy-prices-chart"
              bars={chart.bars}
              height={150}
              highlight
              label={chart.sentence}
            />
            <EnergyChartLegend
              items={chart.legend.map((item) => ({
                label: item.label,
                kind: item.swatch === 'ink' ? 'fill' : 'outline',
                colour: tokens.ink,
              }))}
            />
            <Text style={[TYPE.subhead, { color: tokens.ink }]}>
              {chart.sentence}
            </Text>
          </View>
          {note ? (
            <Text style={[TYPE.footnote, styles.note, { color: tokens.muted }]}>
              {note}
            </Text>
          ) : null}
          <InsetList testID="energy-prices-facts">
            {chart.facts.map((fact) => (
              <InsetRow
                key={fact.label}
                title={fact.label}
                trailing={
                  <Text style={[TYPE.bodyStrong, TABULAR, { color: tokens.ink }]}>
                    {fact.value}
                  </Text>
                }
              />
            ))}
          </InsetList>
          {energyNegativeCards(prices, words, locale).map((card) => (
            <Card key={card.key} style={styles.text}>
              <Text style={[TYPE.bodyStrong, { color: tokens.ink }]}>
                {card.title}
              </Text>
              <Text style={[TYPE.subhead, { color: tokens.ink }]}>
                {card.body}
              </Text>
            </Card>
          ))}
        </>
      ) : (
        <Card style={styles.text}>
          <Text style={[TYPE.bodyStrong, { color: tokens.ink }]}>
            {tab === 'today' ? copy.todayNone : energyTomorrowLine(now, words)}
          </Text>
          {state.problem ? (
            <Text style={[TYPE.subhead, { color: tokens.danger }]}>
              {state.text}
            </Text>
          ) : null}
        </Card>
      )}

      {buildUp ? (
        <BuildUp buildUp={buildUp} />
      ) : tab === 'today' && prices?.basis === 'allIn' && !prices.terms ? (
        <Text style={[TYPE.footnote, styles.note, { color: tokens.muted }]}>
          {fmt(copy.accountNote, {
            provider: energyPriceSourceName(view, words),
          })}
        </Text>
      ) : null}

      <InsetList>
        <InsetRow
          testID="energy-prices-source"
          title={copy.sourceRow}
          subtitle={state.text}
          subtitleTone={state.problem ? 'danger' : 'muted'}
          chevron
          onPress={() => router.push(moduleHref('/all/energy/price-source'))}
        />
      </InsetList>
    </>
  )
}

/** The four parts of the price now, as one bar and as rows. */
function BuildUp({ buildUp }: { buildUp: EnergyPriceBuildUp }) {
  const tokens = useTokens('home')
  const colour = {
    market: tokens.ink,
    markup: tokens.muted,
    tax: tokens.hairStrong,
    vat: tokens.surface2,
  }
  return (
    <View
      testID="energy-price-build-up"
      style={[styles.card, { backgroundColor: tokens.surface }]}
    >
      <Text
        accessibilityRole="header"
        style={[TYPE.bodyStrong, { color: tokens.ink }]}
      >
        {buildUp.title}
      </Text>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={buildUp.label}
        style={styles.stack}
      >
        {buildUp.parts.map((part) =>
          part.share > 0 ? (
            <View
              key={part.key}
              style={{ flex: part.share, backgroundColor: colour[part.key] }}
            />
          ) : null,
        )}
      </View>
      {buildUp.parts.map((part) => (
        <View
          key={part.key}
          accessible
          accessibilityLabel={`${part.label}, ${part.value}`}
          style={styles.part}
        >
          <View style={[styles.swatch, { backgroundColor: colour[part.key] }]} />
          <Text style={[TYPE.subhead, styles.flex, { color: tokens.ink }]}>
            {part.label}
          </Text>
          <Text style={[TYPE.subhead, TABULAR, { color: tokens.ink }]}>
            {part.value}
          </Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACE[4], gap: SPACE[4] },
  card: {
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACE[4],
    paddingVertical: 14,
    gap: SPACE[2],
  },
  text: { gap: SPACE[1], paddingVertical: 14 },
  note: { paddingHorizontal: 4 },
  stack: {
    flexDirection: 'row',
    height: 14,
    gap: 2,
    borderRadius: 7,
    overflow: 'hidden',
  },
  part: { flexDirection: 'row', alignItems: 'center', gap: SPACE[2] },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  flex: { flex: 1 },
})
