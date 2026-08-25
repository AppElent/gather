/**
 * One holding: the position, and how it got there.
 *
 * The opening position is the first row of the history rather than a field
 * above it, because that is what it is — a dated statement of what was held on
 * a day, which every buy, sale, dividend and fee after it builds on.
 *
 * A split, a merger or an ETF change is a **manual adjustment**: the Member
 * says what they hold now and what it cost on average, and Gather changes
 * nothing on its own (ADR-0025). That is the whole corporate-action story, and
 * the notice at the bottom says so.
 */

import { holdingPosition, isStale } from '@gather/core/finance'
import { useMutation, useQuery } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeSheet } from '../../components/NativeSheet'
import { fmt } from '../../i18n'
import { FINANCE_ICONS } from './icons'
import type { FinanceBase } from './paths'
import {
  AddRow,
  Card,
  Chip,
  Disclaimer,
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

type TransactionKind = 'buy' | 'sell' | 'dividend' | 'fee' | 'adjustment'

export function HoldingScreen({
  base: _base,
  holdingId,
}: {
  base: FinanceBase
  holdingId: Id<'holdings'>
}) {
  const tokens = useMoneyTokens()
  const router = useRouter()
  const { groupSlug, format, text, today } = useFinances()
  const holding = useQuery(api.holdings.get, { id: holdingId, groupSlug })
  const addTransaction = useMutation(api.holdings.addTransaction)
  const setPrice = useMutation(api.holdings.setPrice)
  const remove = useMutation(api.holdings.remove)

  const [adding, setAdding] = useState(false)
  const [pricing, setPricing] = useState(false)
  const [kind, setKind] = useState<TransactionKind>('buy')
  const [date, setDate] = useState(today)
  const [units, setUnits] = useState('')
  const [price, setPriceDraft] = useState('')
  const [fee, setFee] = useState('')
  const [note, setNote] = useState('')
  const [newPrice, setNewPrice] = useState('')

  const Target = FINANCE_ICONS.Target
  const Alert_ = FINANCE_ICONS.Alert
  const tint = tokens.tintOf('money')

  if (holding === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.portfolio.title }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={4} label={text.actions.loading} />
        </View>
      </>
    )
  }
  if (holding === null) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.portfolio.title }}
        />
        <ScreenScroll>
          <Notice>{text.portfolio.emptyBody}</Notice>
        </ScreenScroll>
      </>
    )
  }

  const position = holdingPosition(
    {
      date: holding.openingDate,
      units: holding.openingUnits,
      averageCostCents: holding.openingAverageCostCents,
    },
    holding.transactions,
  )
  const quotePrice = holding.lastPriceCents ?? position.averageCostCents
  const marketValue = Math.round(position.units * quotePrice)
  const unrealized = marketValue - position.investedCents
  const stale = isStale(holding.lastPriceAt, Date.now())

  function save() {
    const unitCount = Number(units.replace(',', '.'))
    const cents = Math.round(Number(price.replace(',', '.')) * 100)
    const feeCents = fee
      ? Math.round(Number(fee.replace(',', '.')) * 100)
      : undefined
    addTransaction({
      holdingId,
      groupSlug,
      kind,
      date,
      units:
        kind === 'buy' || kind === 'sell' || kind === 'adjustment'
          ? unitCount
          : undefined,
      pricePerUnitCents:
        kind === 'buy' || kind === 'sell' || kind === 'adjustment'
          ? cents
          : undefined,
      perUnitCents: kind === 'dividend' ? cents : undefined,
      feeCents,
      note: note.trim() || undefined,
    })
    setAdding(false)
    setUnits('')
    setPriceDraft('')
    setFee('')
    setNote('')
  }

  function confirmDelete() {
    Alert.alert(
      fmt(text.errors.confirmDelete, { name: holding?.symbol ?? '' }),
      text.errors.confirmDeleteBody,
      [
        { text: text.actions.cancel, style: 'cancel' },
        {
          text: text.actions.delete,
          style: 'destructive',
          onPress: () => {
            remove({ id: holdingId, groupSlug })
            router.back()
          },
        },
      ],
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: holding.symbol }} />
      <ScreenScroll>
        <Card padded>
          <Figure
            caption={`${holding.name} · ${holding.currency}`}
            amount={format.money(marketValue)}
            sub={`${format.signedMoney(unrealized)} ${fmt(
              text.portfolio.holding.onInvested,
              { amount: format.money(position.investedCents) },
            )}`}
          />
          {holding.lastPriceAt === undefined ? (
            <Notice>{text.portfolio.holding.lastPriceHint}</Notice>
          ) : stale ? (
            <StaleBanner text={text.portfolio.stale} />
          ) : (
            <Notice>
              {`${format.money(quotePrice)} · ${fmt(text.portfolio.pricesAt, {
                time: format.time(holding.lastPriceAt),
              })}`}
            </Notice>
          )}
        </Card>

        <Card>
          <Row
            label={text.portfolio.holding.unitsHeld}
            value={String(position.units)}
            emphasis
          />
          <Row
            label={text.portfolio.holding.averageCost}
            value={format.money(position.averageCostCents)}
            emphasis
          />
          <Row
            label={text.portfolio.holding.lastPrice}
            value={
              holding.lastPriceCents === undefined
                ? '—'
                : format.money(holding.lastPriceCents)
            }
            emphasis={holding.lastPriceCents !== undefined}
            chevron
            last
            onPress={() => {
              setNewPrice(String((holding.lastPriceCents ?? 0) / 100))
              setPricing(true)
            }}
          />
        </Card>

        <Section
          title={fmt(text.portfolio.holding.since, {
            date: format.date(holding.openingDate),
          })}
        />
        <Card>
          <Row
            leading={<Target size={20} color={tint.fg} strokeWidth={1.8} />}
            label={text.portfolio.holding.openingPosition}
            sub={`${format.date(holding.openingDate)} · ${
              holding.openingUnits
            } × ${format.money(holding.openingAverageCostCents)}`}
          />
          {holding.transactions.map((entry, index) => (
            <Row
              key={`${entry.date}-${index}`}
              leading={
                entry.kind === 'adjustment' ? (
                  <Alert_ size={17} color={tokens.danger} strokeWidth={2} />
                ) : undefined
              }
              label={`${text.transactionKinds[entry.kind]} · ${format.date(
                entry.date,
              )}`}
              sub={[
                entry.units !== undefined ? `${entry.units}` : '',
                entry.pricePerUnitCents !== undefined
                  ? format.money(entry.pricePerUnitCents)
                  : '',
                entry.perUnitCents !== undefined
                  ? `${format.money(entry.perUnitCents)} ${text.portfolio.holding.perUnit}`
                  : '',
                entry.feeCents ? format.money(entry.feeCents) : '',
                entry.note ?? '',
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
          <AddRow
            label={text.portfolio.holding.addTransaction}
            onPress={() => {
              setKind('buy')
              setDate(today)
              setAdding(true)
            }}
            last={false}
          />
          <AddRow
            label={text.portfolio.holding.recordAdjustment}
            onPress={() => {
              setKind('adjustment')
              setDate(today)
              setAdding(true)
            }}
          />
        </Card>

        <Notice>{text.portfolio.holding.notice}</Notice>
        <PrimaryButton label={text.actions.delete} onPress={confirmDelete} />
        <Disclaimer />
      </ScreenScroll>

      {adding ? (
        <NativeSheet
          title={
            kind === 'adjustment'
              ? text.portfolio.holding.recordAdjustment
              : text.portfolio.holding.addTransaction
          }
          subtitle={
            kind === 'adjustment'
              ? text.portfolio.holding.adjustmentBody
              : undefined
          }
          onClose={() => setAdding(false)}
          footer={<PrimaryButton label={text.actions.save} onPress={save} />}
        >
          {kind === 'adjustment' ? null : (
            <View style={styles.chips}>
              {(['buy', 'sell', 'dividend', 'fee'] as const).map((option) => (
                <Chip
                  key={option}
                  label={text.transactionKinds[option]}
                  selected={kind === option}
                  onPress={() => setKind(option)}
                />
              ))}
            </View>
          )}
          <Field
            label={text.portfolio.holding.asAt}
            value={date}
            onChangeText={setDate}
            keyboardType="numbers-and-punctuation"
          />
          {kind !== 'dividend' && kind !== 'fee' ? (
            <Field
              label={text.portfolio.holding.units}
              value={units}
              onChangeText={setUnits}
              keyboardType="decimal-pad"
              autoFocus
            />
          ) : null}
          {kind !== 'fee' ? (
            <Field
              label={
                kind === 'dividend'
                  ? text.portfolio.holding.perUnit
                  : kind === 'adjustment'
                    ? text.portfolio.holding.averageCost
                    : text.portfolio.holding.pricePerUnit
              }
              value={price}
              onChangeText={setPriceDraft}
              keyboardType="decimal-pad"
            />
          ) : null}
          <Field
            label={text.portfolio.holding.fee}
            value={fee}
            onChangeText={setFee}
            keyboardType="decimal-pad"
          />
          {kind === 'adjustment' ? (
            <Field
              label={text.portfolio.holding.adjustmentNote}
              value={note}
              onChangeText={setNote}
            />
          ) : null}
        </NativeSheet>
      ) : null}

      {pricing ? (
        <NativeSheet
          title={text.portfolio.holding.lastPrice}
          subtitle={text.portfolio.holding.lastPriceHint}
          onClose={() => setPricing(false)}
          footer={
            <PrimaryButton
              label={text.actions.save}
              onPress={() => {
                const cents = Math.round(
                  Number(newPrice.replace(',', '.')) * 100,
                )
                if (Number.isFinite(cents) && cents >= 0)
                  setPrice({
                    id: holdingId,
                    groupSlug,
                    pricePerUnitCents: cents,
                  })
                setPricing(false)
              }}
            />
          }
        >
          <Field
            label={text.portfolio.holding.price}
            value={newPrice}
            onChangeText={setNewPrice}
            keyboardType="decimal-pad"
            autoFocus
          />
        </NativeSheet>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 6 },
})
