/**
 * The Module's index: Houses, then Money, then Overviews.
 *
 * The order is the decision (ADR-0025). A household opens this to answer a
 * question about a house far more often than to look at what it is worth, so
 * the records that hang off a House come first, the everyday money records
 * next, and the two overviews last — where they inform without getting in the
 * way of a calculation somebody came here to do.
 *
 * Every add on this screen is a row in a list, as everywhere else in gather.
 * There is no `headerRight` in this app and this Module does not introduce one.
 */

import { calculationTotals, recurringTotals } from '@gather/core/finance'
import { useMutation, useQuery } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeSheet } from '../../components/NativeSheet'
import { fmt } from '../../i18n'
import { FINANCE_ICONS } from './icons'
import { toLoanParts } from './loanParts'
import { type FinanceBase, financeHref } from './paths'
import { portfolioTotalsFor } from './portfolioTotals'
import {
  AddRow,
  Card,
  Disclaimer,
  EmptyState,
  Field,
  PrimaryButton,
  Row,
  ScreenScroll,
  Section,
  useMoneyTokens,
} from './ui'
import { useFinances } from './useFinances'

export function FinancesScreen({ base }: { base: FinanceBase }) {
  const tokens = useMoneyTokens()
  const router = useRouter()
  const { groupSlug, format, text, currency, rates } = useFinances()
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const houses = useQuery(api.houses.list, { groupSlug })
  const costs = useQuery(api.recurringCosts.list, { groupSlug })
  const goals = useQuery(api.savingsGoals.list, { groupSlug })
  const holdings = useQuery(api.holdings.list, { groupSlug })
  const snapshots = useQuery(api.netWorth.snapshots, { groupSlug })
  const createHouse = useMutation(api.houses.create)

  const tint = tokens.tintOf('money')
  const HouseIcon = FINANCE_ICONS.House
  const Repeat = FINANCE_ICONS.Repeat
  const Target = FINANCE_ICONS.Target
  const Users = FINANCE_ICONS.Users
  const Chart = FINANCE_ICONS.Chart
  const Scale = FINANCE_ICONS.Scale

  if (houses === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.index.title }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={5} label={text.actions.loading} />
        </View>
      </>
    )
  }

  const nothingYet =
    houses.length === 0 &&
    (costs?.length ?? 0) === 0 &&
    (goals?.length ?? 0) === 0 &&
    (holdings?.length ?? 0) === 0

  function addHouse() {
    const trimmed = name.trim()
    if (!trimmed) return
    createHouse({ groupSlug, name: trimmed })
    setName('')
    setNaming(false)
  }

  const monthlyShare = costs
    ? recurringTotals(
        costs.map((cost) => ({
          amountCents: cost.amountCents,
          frequency: cost.frequency,
          category: cost.category,
          split: cost.split?.map((share) => ({
            memberId: share.userId,
            percent: share.percent,
          })),
        })),
      )
    : null

  const portfolio = holdings
    ? portfolioTotalsFor(holdings, currency, rates)
    : null
  const latestSnapshot = snapshots?.[0]

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: text.index.title }} />
      <ScreenScroll>
        {nothingYet ? (
          <EmptyState
            icon={<HouseIcon size={34} color={tint.fg} strokeWidth={1.6} />}
            title={text.index.emptyTitle}
            body={text.index.emptyBody}
            actionLabel={text.index.addHouse}
            onAction={() => setNaming(true)}
          />
        ) : null}

        {nothingYet ? null : (
          <>
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
                        financeHref(base, '/house', { houseId: house._id }),
                      )
                    }
                  />
                )
              })}
              <AddRow
                label={text.index.addHouse}
                onPress={() => setNaming(true)}
              />
            </Card>

            <Section title={text.index.money} />
            <Card>
              <Row
                leading={<Repeat size={20} color={tint.fg} strokeWidth={1.8} />}
                label={text.index.recurring}
                sub={
                  costs && costs.length > 0
                    ? fmt(text.index.recurringSummary, {
                        count: costs.length,
                        share: format.money(monthlyShare?.monthlyCents ?? 0, {
                          decimals: false,
                        }),
                      })
                    : text.index.recurringEmpty
                }
                value={
                  monthlyShare && costs && costs.length > 0
                    ? format.money(monthlyShare.monthlyCents, {
                        decimals: false,
                      })
                    : undefined
                }
                emphasis
                chevron
                onPress={() => router.push(financeHref(base, '/recurring'))}
              />
              <Row
                leading={<Target size={20} color={tint.fg} strokeWidth={1.8} />}
                label={text.index.savings}
                sub={
                  goals && goals.length > 0
                    ? fmt(text.index.savingsSummary, {
                        name: goals[0].name,
                        date: format.month(goals[0].targetDate),
                      })
                    : text.index.savingsEmpty
                }
                value={
                  goals && goals.length > 0 ? String(goals.length) : undefined
                }
                chevron
                onPress={() => router.push(financeHref(base, '/savings'))}
              />
              <Row
                leading={<Users size={21} color={tint.fg} strokeWidth={1.8} />}
                label={text.index.split}
                sub={text.index.splitSummary}
                chevron
                last
                onPress={() => router.push(financeHref(base, '/split'))}
              />
            </Card>

            <Section title={text.index.overviews} />
            <Card>
              <Row
                leading={<Chart size={20} color={tint.fg} strokeWidth={1.8} />}
                label={text.index.portfolio}
                sub={
                  portfolio && holdings && holdings.length > 0
                    ? portfolio.asOf
                      ? fmt(text.portfolio.pricesAt, {
                          time: format.time(portfolio.asOf),
                        })
                      : text.portfolio.staleBadge
                    : text.index.portfolioEmpty
                }
                value={
                  holdings && holdings.length > 0 && portfolio
                    ? format.money(portfolio.totalValueCents, {
                        decimals: false,
                      })
                    : undefined
                }
                emphasis
                chevron
                onPress={() => router.push(financeHref(base, '/portfolio'))}
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
                onPress={() => router.push(financeHref(base, '/net-worth'))}
              />
            </Card>
          </>
        )}

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
