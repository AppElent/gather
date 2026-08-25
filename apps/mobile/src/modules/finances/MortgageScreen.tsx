/**
 * One Mortgage calculation: its loan parts, what they cost together, and where
 * the steps are.
 *
 * The answer sits in a bar pinned under the list rather than at the top of it,
 * because this screen is a form as much as a report — you change a part, come
 * back, and the figure you came to see has not scrolled away.
 *
 * **Duplicate is the primary action, not Edit.** Changing this calculation is
 * ordinary (tap a part), but asking "what if" makes a copy, which is what keeps
 * a comparison holding the assumptions that produced it (ADR-0025).
 */

import { calculationTotals, mortgageSteps } from '@gather/core/finance'
import { useMutation, useQuery } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeSheet } from '../../components/NativeSheet'
import { fmt } from '../../i18n'
import { RADIUS } from '../../theme/tokens'
import { dateForMonth } from './format'
import { FINANCE_ICONS } from './icons'
import { termWords, toLoanParts } from './loanParts'
import { type FinanceBase, financeHref } from './paths'
import {
  AddRow,
  AnswerBar,
  Card,
  Disclaimer,
  Field,
  Notice,
  PrimaryButton,
  Row,
  ScreenScroll,
  Section,
  useMoneyTokens,
} from './ui'
import { useFinances } from './useFinances'

export function MortgageScreen({
  base,
  calculationId,
}: {
  base: FinanceBase
  calculationId: Id<'mortgageCalculations'>
}) {
  const tokens = useMoneyTokens()
  const router = useRouter()
  const { groupSlug, format, text, today } = useFinances()
  const calculation = useQuery(api.mortgages.get, {
    id: calculationId,
    groupSlug,
  })
  const addPart = useMutation(api.mortgages.addPart)
  const duplicate = useMutation(api.mortgages.duplicate)
  const remove = useMutation(api.mortgages.remove)

  const [copyName, setCopyName] = useState<string | null>(null)
  const Clock = FINANCE_ICONS.Clock
  const tint = tokens.tintOf('money')

  if (calculation === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.mortgage.parts }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={4} label={text.actions.loading} />
        </View>
      </>
    )
  }
  if (calculation === null) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.mortgage.parts }}
        />
        <ScreenScroll>
          <Notice>{text.mortgage.noPartsBody}</Notice>
        </ScreenScroll>
      </>
    )
  }

  const parts = toLoanParts(calculation.parts, today)
  const totals = calculationTotals(parts)
  const steps = mortgageSteps(parts)

  /**
   * A new part starts as a blank annuity rather than asking for eight fields in
   * a sheet: the part's own screen is where every one of them is edited anyway,
   * so the sheet would be a second, worse copy of it.
   */
  function addBlankPart() {
    addPart({
      calculationId,
      groupSlug,
      kind: 'annuity',
      principalCents: 10_000_00,
      annualRatePercent: 4,
      termMonths: 360,
    })
  }

  function confirmDelete() {
    Alert.alert(
      fmt(text.errors.confirmDelete, { name: calculation?.name ?? '' }),
      text.errors.confirmDeleteBody,
      [
        { text: text.actions.cancel, style: 'cancel' },
        {
          text: text.actions.delete,
          style: 'destructive',
          onPress: () => {
            remove({ id: calculationId, groupSlug })
            router.back()
          },
        },
      ],
    )
  }

  const partCount =
    calculation.parts.length === 1
      ? text.index.onePart
      : fmt(text.index.partCount, { count: calculation.parts.length })

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: calculation.name }} />
      <ScreenScroll bottomInset={90}>
        <Section title={text.mortgage.parts} />
        <Card>
          {calculation.parts.map((part, index) => {
            const schedule = totals.schedules[index]
            return (
              <Row
                key={part._id}
                label={`${fmt(text.loanPart.title, { index: index + 1 })} · ${
                  text.loanPartKinds[part.kind]
                }`}
                sub={[
                  format.money(part.principalCents, { decimals: false }),
                  format.percent(part.annualRatePercent),
                  part.fixedUntil
                    ? `${text.loanPart.fixedUntil} ${format.month(part.fixedUntil)}`
                    : text.loanPart.fixedUntilUnset,
                  termWords(part.termMonths, text.loanPart),
                ].join(' · ')}
                value={format.money(schedule.monthlyPaymentCents, {
                  decimals: false,
                })}
                emphasis
                chevron
                onPress={() =>
                  router.push(financeHref(base, '/part', { partId: part._id }))
                }
              />
            )
          })}
          <AddRow label={text.mortgage.addPart} onPress={addBlankPart} />
        </Card>

        {calculation.parts.length === 0 ? (
          <Notice>{text.mortgage.noPartsBody}</Notice>
        ) : (
          <>
            <Section title={text.mortgage.together} />
            <Card>
              <Row
                label={text.mortgage.outstanding}
                value={format.money(totals.outstandingCents, {
                  decimals: false,
                })}
                emphasis
              />
              <Row
                label={text.mortgage.interestToPay}
                value={format.money(totals.totalInterestCents, {
                  decimals: false,
                })}
                emphasis
              />
              {totals.totalChargeCents > 0 ? (
                <Row
                  label={text.mortgage.charges}
                  value={format.money(totals.totalChargeCents, {
                    decimals: false,
                  })}
                  emphasis
                />
              ) : null}
              <Row
                label={text.mortgage.lastPaidOff}
                value={format.month(
                  dateForMonth(totals.lastPayoffMonth, today),
                )}
                emphasis
                last
              />
            </Card>

            <Section title={text.mortgage.whenFixesEnd} />
            <Card>
              {steps.length > 1 ? (
                <Row
                  leading={
                    <Clock size={20} color={tint.fg} strokeWidth={1.8} />
                  }
                  label={fmt(text.mortgage.stepsSummary, {
                    count: steps.length,
                    from: format.month(dateForMonth(steps[1].month, today)),
                    to: format.month(
                      dateForMonth(steps[steps.length - 1].month, today),
                    ),
                  })}
                  sub={steps
                    .slice(0, 3)
                    .map((step) =>
                      format.money(step.monthlyCents, { decimals: false }),
                    )
                    .join(' → ')}
                  chevron
                  last
                  onPress={() =>
                    router.push(
                      financeHref(base, '/timeline', { calculationId }),
                    )
                  }
                />
              ) : (
                <Row
                  leading={
                    <Clock size={20} color={tokens.muted} strokeWidth={1.8} />
                  }
                  label={text.mortgage.oneStep}
                  sub={text.mortgage.oneStepSub}
                  last
                />
              )}
            </Card>
          </>
        )}

        <Notice>{text.mortgage.notice}</Notice>
        <PrimaryButton label={text.actions.delete} onPress={confirmDelete} />
        <Disclaimer />
      </ScreenScroll>

      <AnswerBar
        amount={format.money(totals.monthlyCents, { decimals: false })}
        unit={text.recurringCosts.aMonth}
        sub={fmt(text.mortgage.barSub, {
          parts: partCount,
          outstanding: format.money(totals.outstandingCents, {
            decimals: false,
          }),
        })}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text.actions.duplicate}
            onPress={() =>
              setCopyName(
                fmt(text.house.copySuffix, { name: calculation.name }),
              )
            }
            style={({ pressed }) => [
              styles.ghost,
              { borderColor: tokens.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.ghostLabel, { color: tokens.fg }]}>
              {text.actions.duplicate}
            </Text>
          </Pressable>
        }
      />

      {copyName !== null ? (
        <NativeSheet
          title={text.actions.duplicate}
          subtitle={text.mortgage.duplicateNotice}
          onClose={() => setCopyName(null)}
          footer={
            <PrimaryButton
              label={text.actions.duplicate}
              onPress={() => {
                const name = copyName.trim()
                if (!name) return
                duplicate({ id: calculationId, groupSlug, name })
                setCopyName(null)
              }}
              disabled={copyName.trim().length === 0}
            />
          }
        >
          <Field
            label={text.house.nameLabel}
            value={copyName}
            onChangeText={setCopyName}
            autoFocus
          />
        </NativeSheet>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  ghost: {
    minHeight: 40,
    borderRadius: RADIUS.control,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { fontSize: 14.5, fontWeight: '600' },
})
