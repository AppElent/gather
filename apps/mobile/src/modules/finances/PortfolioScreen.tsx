/**
 * What the Group's holdings are worth — information, not advice (ADR-0026).
 *
 * Three rules the screen exists to keep:
 *
 * - **Every figure carries the moment it is as at.** A price without one is not
 *   a price, so a holding with none reads as having no price rather than as
 *   being worth nothing.
 * - **Stale is marked, never blanked.** The last known value is still the
 *   honest one; hiding its age is the only way to turn it into a lie.
 * - **Average cost, and it says so.** The performance figures are informational
 *   and are not tax figures.
 *
 * There is no quote provider wired up yet, so a price is one a Member entered.
 * The screen does not know the difference and will not need changing when one
 * arrives — it reads the price and its age off the same two fields either way.
 */

import { holdingPosition } from '@gather/core/finance'
import { useMutation, useQuery } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeSheet } from '../../components/NativeSheet'
import { Segmented } from '../../components/Segmented'
import { fmt } from '../../i18n'
import { FINANCE_ICONS } from './icons'
import { type FinanceBase, financeHref } from './paths'
import { portfolioTotalsFor } from './portfolioTotals'
import {
  AddRow,
  Card,
  Disclaimer,
  EmptyState,
  Field,
  Figure,
  Notice,
  PrimaryButton,
  Row,
  ScreenScroll,
  Section,
  StaleBanner,
  useMoneyTokens,
} from './ui'
import { useFinances } from './useFinances'

export function PortfolioScreen({ base }: { base: FinanceBase }) {
  const tokens = useMoneyTokens()
  const router = useRouter()
  const { groupSlug, format, text, currency, rates, today } = useFinances()
  const holdings = useQuery(api.holdings.list, { groupSlug })
  const create = useMutation(api.holdings.create)

  const [adding, setAdding] = useState(false)
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [exchange, setExchange] = useState('')
  const [holdingCurrency, setHoldingCurrency] = useState(currency)
  const [kind, setKind] = useState<'stock' | 'etf'>('etf')
  const [units, setUnits] = useState('')
  const [price, setPrice] = useState('')
  const [asAt, setAsAt] = useState(today)

  const tint = tokens.tintOf('money')
  const Chart = FINANCE_ICONS.Chart

  if (holdings === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.portfolio.title }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={5} label={text.actions.loading} />
        </View>
      </>
    )
  }

  const totals = portfolioTotalsFor(holdings, currency, rates)

  function open() {
    setSymbol('')
    setName('')
    setExchange('')
    setHoldingCurrency(currency)
    setUnits('')
    setPrice('')
    setAsAt(today)
    setAdding(true)
  }

  function save() {
    const unitCount = Number(units.replace(',', '.'))
    const cents = Math.round(Number(price.replace(',', '.')) * 100)
    if (!symbol.trim() || !name.trim()) return
    if (!Number.isFinite(unitCount) || unitCount <= 0) return
    if (!Number.isFinite(cents) || cents < 0) return
    create({
      groupSlug,
      kind,
      symbol: symbol.trim(),
      name: name.trim(),
      exchange: exchange.trim() || undefined,
      currency: holdingCurrency.trim() || currency,
      openingDate: asAt,
      openingUnits: unitCount,
      openingAverageCostCents: cents,
      lastPriceCents: cents,
    })
    setAdding(false)
  }

  const valid =
    symbol.trim().length > 0 &&
    name.trim().length > 0 &&
    Number(units.replace(',', '.')) > 0

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: text.portfolio.title }}
      />
      <ScreenScroll>
        {holdings.length === 0 ? (
          <EmptyState
            icon={<Chart size={34} color={tint.fg} strokeWidth={1.6} />}
            title={text.portfolio.emptyTitle}
            body={text.portfolio.emptyBody}
            actionLabel={text.portfolio.addHolding}
            onAction={open}
          />
        ) : (
          <>
            <Card padded>
              <Figure
                caption={fmt(text.portfolio.totalValue, { currency })}
                amount={format.money(totals.totalValueCents)}
                sub={
                  totals.unrealizedPercent === null
                    ? undefined
                    : `${format.signedMoney(totals.unrealizedCents)} · ${format.percent(
                        totals.unrealizedPercent,
                        1,
                      )} ${text.portfolio.sinceYouBought}`
                }
              />
              {totals.stale ? (
                <StaleBanner text={text.portfolio.stale} />
              ) : totals.asOf ? (
                <Notice>
                  {fmt(text.portfolio.pricesAt, {
                    time: format.time(totals.asOf),
                  })}
                </Notice>
              ) : null}
            </Card>

            <Section
              title={
                holdings.length === 1
                  ? text.portfolio.oneHolding
                  : fmt(text.portfolio.holdingCount, { count: holdings.length })
              }
            />
            <Card>
              {holdings.map((holding) => {
                const value = totals.values.find(
                  (row) => row.id === holding._id,
                )
                // The units held now, not the ones the position opened with:
                // a sale the household recorded has to move this figure.
                const position = holdingPosition(
                  {
                    date: holding.openingDate,
                    units: holding.openingUnits,
                    averageCostCents: holding.openingAverageCostCents,
                  },
                  holding.transactions,
                )
                return (
                  <Row
                    key={holding._id}
                    label={holding.symbol}
                    sub={fmt(text.portfolio.unitsAt, {
                      units: position.units,
                      price:
                        holding.lastPriceCents === undefined
                          ? '—'
                          : format.money(holding.lastPriceCents),
                    })}
                    value={format.money(value?.homeValueCents ?? 0, {
                      decimals: false,
                    })}
                    valueSub={
                      value?.stale
                        ? text.portfolio.staleBadge
                        : value?.unrealizedPercent === null ||
                            value?.unrealizedPercent === undefined
                          ? undefined
                          : format.percent(value.unrealizedPercent, 1)
                    }
                    valueTone={
                      (value?.unrealizedCents ?? 0) < 0 ? 'down' : 'up'
                    }
                    emphasis
                    chevron
                    onPress={() =>
                      router.push(
                        financeHref(base, '/holding', {
                          holdingId: holding._id,
                        }),
                      )
                    }
                  />
                )
              })}
              <AddRow label={text.portfolio.addHolding} onPress={open} />
            </Card>

            <Section title={text.portfolio.informational} />
            <Card>
              <Row
                label={text.portfolio.realized}
                value={format.money(totals.realizedCents)}
                emphasis
              />
              <Row
                label={text.portfolio.dividends}
                value={format.money(totals.dividendsCents)}
                emphasis
              />
              <Row
                label={text.portfolio.fees}
                value={format.money(totals.feesCents)}
                emphasis
                last
              />
            </Card>
          </>
        )}

        <Notice>{text.portfolio.notice}</Notice>
        <Disclaimer />
      </ScreenScroll>

      {adding ? (
        <NativeSheet
          title={text.portfolio.addHolding}
          subtitle={text.portfolio.holding.listedOnly}
          onClose={() => setAdding(false)}
          footer={
            <PrimaryButton
              label={text.actions.add}
              onPress={save}
              disabled={!valid}
            />
          }
        >
          <View style={styles.segment}>
            <Segmented<'stock' | 'etf'>
              options={[
                { value: 'etf', label: text.holdingKinds.etf },
                { value: 'stock', label: text.holdingKinds.stock },
              ]}
              value={kind}
              onChange={setKind}
            />
          </View>
          <Field
            label={text.portfolio.holding.symbol}
            value={symbol}
            onChangeText={setSymbol}
            autoFocus
          />
          <Field
            label={text.portfolio.holding.name}
            value={name}
            onChangeText={setName}
          />
          <Field
            label={text.portfolio.holding.exchange}
            value={exchange}
            onChangeText={setExchange}
          />
          <Field
            label={text.portfolio.holding.currency}
            value={holdingCurrency}
            onChangeText={setHoldingCurrency}
          />
          <Field
            label={text.portfolio.holding.units}
            value={units}
            onChangeText={setUnits}
            keyboardType="decimal-pad"
          />
          <Field
            label={text.portfolio.holding.averagePrice}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />
          <Field
            label={text.portfolio.holding.asAt}
            value={asAt}
            onChangeText={setAsAt}
            keyboardType="numbers-and-punctuation"
          />
          <Notice>{text.portfolio.holding.openingBody}</Notice>
        </NativeSheet>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  segment: { paddingVertical: 6 },
})
