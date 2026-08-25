/**
 * When the fixes end.
 *
 * Because each part's fix ends on its own date, the answer is a series of dated
 * steps rather than one figure (ADR-0025). Each row says what changed and why —
 * and every rate after a fix ends is one the Member entered on that part, which
 * the closing notice says out loud.
 *
 * No chart. A four-row list of "this month, this much, because of this" is what
 * a household actually reads, and a line that only ever goes up in steps is a
 * decoration around the same four numbers.
 */

import { mortgageSteps } from '@gather/core/finance'
import { useQuery } from 'convex/react'
import { Stack } from 'expo-router'
import { View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { fmt } from '../../i18n'
import { dateForMonth } from './format'
import { toLoanParts } from './loanParts'
import type { FinanceBase } from './paths'
import {
  Card,
  Disclaimer,
  Notice,
  Row,
  ScreenScroll,
  Section,
  useMoneyTokens,
} from './ui'
import { useFinances } from './useFinances'

export function TimelineScreen({
  base: _base,
  calculationId,
}: {
  base: FinanceBase
  calculationId: Id<'mortgageCalculations'>
}) {
  const tokens = useMoneyTokens()
  const { groupSlug, format, text, today } = useFinances()
  const calculation = useQuery(api.mortgages.get, {
    id: calculationId,
    groupSlug,
  })

  if (calculation === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.timeline.title }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={4} label={text.actions.loading} />
        </View>
      </>
    )
  }

  const parts = calculation ? toLoanParts(calculation.parts, today) : []
  const steps = mortgageSteps(parts)
  const steepest = steps.reduce(
    (worst, step) => (step.monthlyCents > worst.monthlyCents ? step : worst),
    steps[0] ?? { month: 1, monthlyCents: 0, deltaCents: 0, changes: [] },
  )

  /** What moved, in the Member's own words rather than in the seam's. */
  function why(step: (typeof steps)[number]): string {
    if (step.month === 1) return text.timeline.todaySub
    return step.changes
      .map((change) => {
        const part = calculation?.parts[change.partIndex]
        const index = change.partIndex + 1
        if (change.reason === 'refix')
          return fmt(text.timeline.refix, {
            index,
            rate: part?.expiryRatePercent ?? part?.annualRatePercent ?? 0,
          })
        if (change.reason === 'paidOff')
          return fmt(text.timeline.paidOff, { index })
        return fmt(text.timeline.repayment, { index })
      })
      .join(' · ')
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: text.timeline.title }}
      />
      <ScreenScroll>
        <Section title={text.timeline.eachStep} />
        <Card>
          {steps.map((step, index) => (
            <Row
              key={step.month}
              label={
                step.month === 1
                  ? text.timeline.today
                  : format.month(dateForMonth(step.month, today))
              }
              sub={why(step)}
              value={format.money(step.monthlyCents, { decimals: false })}
              valueSub={
                step.deltaCents === 0
                  ? undefined
                  : format.signedMoney(step.deltaCents)
              }
              valueTone={step.deltaCents > 0 ? 'down' : 'up'}
              emphasis
              last={index === steps.length - 1}
            />
          ))}
        </Card>

        {steps.length > 1 ? (
          <Notice>
            {`${fmt(text.timeline.steepest, {
              month: format.month(dateForMonth(steepest.month, today)),
              amount: format.money(steepest.monthlyCents, { decimals: false }),
            })} ${fmt(text.timeline.steepestDelta, {
              amount: format.money(
                steepest.monthlyCents - (steps[0]?.monthlyCents ?? 0),
                { decimals: false },
              ),
            })} ${text.timeline.steepestTail}`}
          </Notice>
        ) : null}

        <Notice>{text.timeline.notice}</Notice>
        <Disclaimer />
      </ScreenScroll>
    </>
  )
}
