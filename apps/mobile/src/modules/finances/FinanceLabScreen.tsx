/**
 * The unfinished money tools, reachable only through Settings > Labs.
 *
 * This is deliberately not a Module index. Released money workflows have
 * their own Module identities; the lab keeps only Houses and mortgages,
 * Portfolio, and Net worth available to developers while those designs settle.
 */
import { calculationTotals } from '@gather/core/finance'
import { useMutation, useQuery } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeSheet } from '../../components/NativeSheet'
import { fmt, useI18n } from '../../i18n'
import { FINANCE_ICONS } from './icons'
import { toLoanParts } from './loanParts'
import { type FinanceBase, financeHref } from './paths'
import { portfolioTotalsFor } from './portfolioTotals'
import {
  AddRow,
  Card,
  Disclaimer,
  Field,
  PrimaryButton,
  Row,
  ScreenScroll,
  Section,
  useMoneyTokens,
} from './ui'
import { useFinances } from './useFinances'

const BASE = '/settings/labs/finance' satisfies FinanceBase

export function FinanceLabScreen() {
  const tokens = useMoneyTokens()
  const router = useRouter()
  const { t } = useI18n()
  const { groupSlug, format, text, currency, rates } = useFinances()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const houses = useQuery(api.houses.list, { groupSlug })
  const holdings = useQuery(api.holdings.list, { groupSlug })
  const snapshots = useQuery(api.netWorth.snapshots, { groupSlug })
  const createHouse = useMutation(api.houses.create)

  const tint = tokens.tintOf('money')
  const HouseIcon = FINANCE_ICONS.House
  const Chart = FINANCE_ICONS.Chart
  const Scale = FINANCE_ICONS.Scale

  if (
    houses === undefined ||
    holdings === undefined ||
    snapshots === undefined
  ) {
    return (
      <>
        <Stack.Screen options={{ title: t.labs.finance.title }} />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={5} label={text.actions.loading} />
        </View>
      </>
    )
  }

  const portfolio = portfolioTotalsFor(holdings, currency, rates)
  const latestSnapshot = snapshots[0]

  function addHouse() {
    const trimmed = name.trim()
    if (!trimmed) return
    createHouse({ groupSlug, name: trimmed })
    setName('')
    setNaming(false)
  }

  return (
    <>
      <Stack.Screen options={{ title: t.labs.finance.title }} />
      <ScreenScroll>
        <Section title={text.index.houses} />
        <Card>
          {houses.map((house) => {
            const totals = calculationTotals(toLoanParts(house.parts))
            return (
              <Row
                key={house._id}
                leading={
                  <HouseIcon size={21} color={tint.fg} strokeWidth={1.8} />
                }
                label={house.name}
                sub={
                  house.parts.length > 0
                    ? fmt(text.index.houseSummary, {
                        monthly: format.money(totals.monthlyCents, {
                          decimals: false,
                        }),
                        parts:
                          house.parts.length === 1
                            ? text.index.onePart
                            : fmt(text.index.partCount, {
                                count: house.parts.length,
                              }),
                      })
                    : text.index.houseNoMortgage
                }
                chevron
                onPress={() =>
                  router.push(
                    financeHref(BASE, '/house', { houseId: house._id }),
                  )
                }
              />
            )
          })}
          <AddRow label={text.index.addHouse} onPress={() => setNaming(true)} />
        </Card>

        <Section title={text.index.overviews} />
        <Card>
          <Row
            leading={<Chart size={20} color={tint.fg} strokeWidth={1.8} />}
            label={text.index.portfolio}
            sub={
              holdings.length > 0
                ? portfolio.asOf
                  ? fmt(text.portfolio.pricesAt, {
                      time: format.time(portfolio.asOf),
                    })
                  : text.portfolio.staleBadge
                : text.index.portfolioEmpty
            }
            value={
              holdings.length > 0
                ? format.money(portfolio.totalValueCents, { decimals: false })
                : undefined
            }
            emphasis
            chevron
            onPress={() => router.push(financeHref(BASE, '/portfolio'))}
          />
          <Row
            leading={<Scale size={20} color={tint.fg} strokeWidth={1.8} />}
            label={text.index.netWorth}
            sub={
              latestSnapshot
                ? format.date(latestSnapshot.takenOn)
                : text.netWorth.noSnapshot
            }
            value={
              latestSnapshot
                ? format.money(latestSnapshot.netCents, { decimals: false })
                : undefined
            }
            emphasis
            chevron
            last
            onPress={() => router.push(financeHref(BASE, '/net-worth'))}
          />
        </Card>
        <Disclaimer />
      </ScreenScroll>

      {naming ? (
        <NativeSheet
          title={text.house.newTitle}
          subtitle={text.house.newBody}
          onClose={() => setNaming(false)}
          footer={
            <PrimaryButton
              label={text.actions.add}
              onPress={addHouse}
              disabled={name.trim().length === 0}
            />
          }
        >
          <Field
            label={text.house.nameLabel}
            value={name}
            onChangeText={setName}
            placeholder={text.house.namePlaceholder}
            autoFocus
          />
        </NativeSheet>
      ) : null}
    </>
  )
}
