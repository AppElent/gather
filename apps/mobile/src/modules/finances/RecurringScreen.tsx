/**
 * What the household pays over and over, grouped by category.
 *
 * The header carries the two figures that matter: what it costs the household,
 * and what this Member's share of that comes to. Neither is a debt — a split
 * ratio divides a standing cost and nothing accrues, which the closing notice
 * says because the screen otherwise looks like a ledger.
 */

import {
  annualCents,
  type CostCategory,
  monthlyCents,
  recurringTotals,
} from '@gather/core/finance'
import { useQuery } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { Segmented } from '../../components/Segmented'
import { fmt } from '../../i18n'
import { FINANCE_ICONS } from './icons'
import { type FinanceBase, financeHref } from './paths'
import {
  AddRow,
  Card,
  Disclaimer,
  EmptyState,
  Figure,
  Notice,
  Row,
  ScreenScroll,
  Section,
  useMoneyTokens,
} from './ui'
import { useCostSheet } from './useCostSheet'
import { useFinances } from './useFinances'

export function RecurringScreen({ base }: { base: FinanceBase }) {
  const tokens = useMoneyTokens()
  const router = useRouter()
  const { groupSlug, format, text } = useFinances()
  const costs = useQuery(api.recurringCosts.list, { groupSlug })
  const me = useQuery(api.users.me, {})
  const [period, setPeriod] = useState<'month' | 'year'>('month')
  const sheet = useCostSheet(groupSlug)

  const tint = tokens.tintOf('money')
  const Repeat = FINANCE_ICONS.Repeat

  if (costs === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.recurringCosts.title }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={5} label={text.actions.loading} />
        </View>
      </>
    )
  }

  const totals = recurringTotals(
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
  const myShare = me ? (totals.perMemberMonthlyCents.get(me._id) ?? 0) : 0
  const sharePercent =
    totals.monthlyCents > 0
      ? Math.round((myShare / totals.monthlyCents) * 100)
      : 0

  const byCategory = new Map<CostCategory, typeof costs>()
  for (const cost of costs) {
    byCategory.set(cost.category, [
      ...(byCategory.get(cost.category) ?? []),
      cost,
    ])
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: text.recurringCosts.title }}
      />
      <ScreenScroll>
        {costs.length === 0 ? (
          <EmptyState
            icon={<Repeat size={34} color={tint.fg} strokeWidth={1.6} />}
            title={text.recurringCosts.emptyTitle}
            body={text.recurringCosts.emptyBody}
            actionLabel={text.recurringCosts.addCost}
            onAction={sheet.open}
          />
        ) : (
          <>
            <Card padded>
              <View style={styles.headline}>
                <View style={styles.half}>
                  <Figure
                    caption={text.recurringCosts.household}
                    amount={format.money(
                      period === 'month'
                        ? totals.monthlyCents
                        : totals.annualCents,
                      { decimals: false },
                    )}
                    sub={
                      period === 'month'
                        ? text.recurringCosts.aMonth
                        : text.recurringCosts.aYear
                    }
                  />
                </View>
                <View style={styles.half}>
                  <Figure
                    caption={text.recurringCosts.yourShare}
                    amount={format.money(
                      period === 'month' ? myShare : myShare * 12,
                      { decimals: false },
                    )}
                    sub={fmt(text.recurringCosts.shareAverage, {
                      percent: sharePercent,
                    })}
                    large={false}
                  />
                </View>
              </View>
            </Card>

            <View style={styles.segment}>
              <Segmented<'month' | 'year'>
                options={[
                  { value: 'month', label: text.recurringCosts.perMonth },
                  { value: 'year', label: text.recurringCosts.perYear },
                ]}
                value={period}
                onChange={setPeriod}
              />
            </View>

            {[...byCategory.entries()].map(([category, rows]) => (
              <View key={category}>
                <Section title={text.categories[category]} />
                <Card>
                  {rows.map((cost, index) => (
                    <Row
                      key={cost._id}
                      label={cost.name}
                      sub={[
                        text.frequencies[cost.frequency],
                        cost.split && cost.split.length > 0
                          ? cost.split.map((share) => share.percent).join(' / ')
                          : text.recurringCosts.cost.splitUnset,
                      ].join(' · ')}
                      value={format.money(
                        period === 'month'
                          ? monthlyCents(cost)
                          : annualCents(cost),
                      )}
                      emphasis
                      chevron
                      last={index === rows.length - 1}
                      onPress={() =>
                        router.push(
                          financeHref(base, '/cost', { costId: cost._id }),
                        )
                      }
                    />
                  ))}
                </Card>
              </View>
            ))}

            <View style={{ marginTop: 12 }}>
              <Card>
                <AddRow
                  label={text.recurringCosts.addCost}
                  onPress={sheet.open}
                />
              </Card>
            </View>
          </>
        )}

        <Notice>{text.recurringCosts.notice}</Notice>
        <Disclaimer />
      </ScreenScroll>

      {sheet.element}
    </>
  )
}

const styles = StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  half: { flex: 1 },
  segment: { paddingVertical: 6 },
})
