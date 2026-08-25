/**
 * What the household owns and owes today, and the days it chose to remember.
 *
 * The tinted rows are calculated rather than typed — the House's value, that
 * House's mortgage balance, and the Portfolio (ADR-0025). That is the point of
 * the screen: a household that has already modelled its mortgage part by part
 * should not be asked to type a balance and get a different number.
 *
 * A snapshot is explicit, dated, and never edited afterwards. It freezes the
 * derived rows too, including the moment the prices came from, which is why
 * `take` sends the rows this screen was showing rather than recomputing them
 * on the server.
 */

import { calculationTotals, netWorthTotals } from '@gather/core/finance'
import { useMutation, useQuery } from 'convex/react'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeSheet } from '../../components/NativeSheet'
import { fmt } from '../../i18n'
import { FINANCE_ICONS } from './icons'
import { toLoanParts } from './loanParts'
import { netWorthRows } from './netWorthRows'
import type { FinanceBase } from './paths'
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
  useMoneyTokens,
} from './ui'
import { useFinances } from './useFinances'

export function NetWorthScreen({ base: _base }: { base: FinanceBase }) {
  const tokens = useMoneyTokens()
  const { groupSlug, format, text, currency, rates, today } = useFinances()
  const houses = useQuery(api.houses.list, { groupSlug })
  const holdings = useQuery(api.holdings.list, { groupSlug })
  const entries = useQuery(api.netWorth.entries, { groupSlug })
  const snapshots = useQuery(api.netWorth.snapshots, { groupSlug })
  const addEntry = useMutation(api.netWorth.addEntry)
  const take = useMutation(api.netWorth.take)

  const [adding, setAdding] = useState<'asset' | 'liability' | null>(null)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')

  const tint = tokens.tintOf('money')
  const Scale = FINANCE_ICONS.Scale

  if (houses === undefined || entries === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.netWorth.title }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={5} label={text.actions.loading} />
        </View>
      </>
    )
  }

  const portfolio = holdings
    ? portfolioTotalsFor(holdings, currency, rates)
    : null
  const rows = netWorthRows({
    houses: houses.map((house) => ({
      name: house.name,
      valueCents: house.valueCents,
      valueAsOf: house.valueAsOf,
      mortgageOutstandingCents:
        house.parts.length > 0
          ? calculationTotals(toLoanParts(house.parts, today)).outstandingCents
          : undefined,
    })),
    portfolioCents:
      holdings && holdings.length > 0
        ? (portfolio?.totalValueCents ?? 0)
        : null,
    portfolioAsOf: today,
    manual: entries.map((entry) => ({
      kind: entry.kind,
      label: entry.label,
      amountCents: entry.amountCents,
    })),
    labels: {
      portfolio: text.index.portfolio,
      mortgage: text.buyingCosts.mortgage,
    },
  })
  const totals = netWorthTotals(rows)
  const previous = snapshots?.[0]
  const change = previous ? totals.netCents - previous.netCents : null

  function save() {
    const cents = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!adding || !label.trim() || !Number.isFinite(cents) || cents < 0) return
    addEntry({
      groupSlug,
      kind: adding,
      label: label.trim(),
      amountCents: cents,
    })
    setLabel('')
    setAmount('')
    setAdding(null)
  }

  const assets = rows.filter((row) => row.kind === 'asset')
  const liabilities = rows.filter((row) => row.kind === 'liability')

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: text.netWorth.title }}
      />
      <ScreenScroll>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Scale size={34} color={tint.fg} strokeWidth={1.6} />}
            title={text.netWorth.emptyTitle}
            body={text.netWorth.emptyBody}
            actionLabel={text.netWorth.addAsset}
            onAction={() => setAdding('asset')}
          />
        ) : (
          <>
            <Card padded>
              <Figure
                caption={text.netWorth.today}
                amount={format.money(totals.netCents, { decimals: false })}
                sub={
                  previous && change !== null
                    ? fmt(
                        change >= 0
                          ? text.netWorth.sinceSnapshot
                          : text.netWorth.downSinceSnapshot,
                        {
                          amount: format.money(Math.abs(change), {
                            decimals: false,
                          }),
                          date: format.date(previous.takenOn),
                        },
                      )
                    : text.netWorth.noSnapshot
                }
              />
            </Card>

            <Section title={text.netWorth.assets} />
            <Card>
              {assets.map((row, index) => (
                <Row
                  key={`${row.source}-${row.label}-${index}`}
                  label={row.label}
                  sub={[
                    text.sources[row.source],
                    row.asOf ? format.date(row.asOf) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  value={format.money(row.amountCents, { decimals: false })}
                  emphasis
                  derived={row.source !== 'manual'}
                />
              ))}
              <AddRow
                label={text.netWorth.addAsset}
                onPress={() => setAdding('asset')}
              />
            </Card>

            <Section title={text.netWorth.liabilities} />
            <Card>
              {liabilities.map((row, index) => (
                <Row
                  key={`${row.source}-${row.label}-${index}`}
                  label={row.label}
                  sub={text.sources[row.source]}
                  value={`− ${format.money(row.amountCents, {
                    decimals: false,
                  })}`}
                  emphasis
                  derived={row.source !== 'manual'}
                />
              ))}
              <AddRow
                label={text.netWorth.addLiability}
                onPress={() => setAdding('liability')}
              />
            </Card>

            <PrimaryButton
              label={text.netWorth.takeSnapshot}
              onPress={() => take({ groupSlug, takenOn: today, rows })}
            />
            <Notice>{text.netWorth.snapshotBody}</Notice>
          </>
        )}

        {snapshots && snapshots.length > 0 ? (
          <>
            <Section title={text.netWorth.snapshots} />
            <Card>
              {snapshots.map((snapshot, index) => (
                <Row
                  key={snapshot._id}
                  label={format.date(snapshot.takenOn)}
                  sub={
                    snapshot.takenByName
                      ? fmt(text.netWorth.takenBy, {
                          name: snapshot.takenByName,
                        })
                      : undefined
                  }
                  value={format.money(snapshot.netCents, { decimals: false })}
                  emphasis
                  last={index === snapshots.length - 1}
                />
              ))}
            </Card>
          </>
        ) : null}

        <Notice>{text.netWorth.notice}</Notice>
        <Disclaimer />
      </ScreenScroll>

      {adding ? (
        <NativeSheet
          title={
            adding === 'asset'
              ? text.netWorth.addAsset
              : text.netWorth.addLiability
          }
          onClose={() => setAdding(null)}
          footer={<PrimaryButton label={text.actions.save} onPress={save} />}
        >
          <Field
            label={text.netWorth.label}
            value={label}
            onChangeText={setLabel}
            autoFocus
          />
          <Field
            label={text.netWorth.amount}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
        </NativeSheet>
      ) : null}
    </>
  )
}
