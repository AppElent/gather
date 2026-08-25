/**
 * One loan part, and the answer while you type.
 *
 * Everything on this screen belongs to *this* part: its amount, its structure,
 * its rate, when its fix ends, what the Member says the rate becomes then, and
 * its extra repayments. That last one is the rule ADR-0025 states and the
 * screen's notice repeats — a repayment belongs to the part it is paid off,
 * because that is the part whose interest it saves.
 *
 * The bar shows what this part costs and what the whole calculation costs, so
 * changing a rate here answers both questions without navigating back.
 */

import {
  calculationTotals,
  LOAN_PART_KINDS,
  type LoanPartKind,
  monthsUntil,
  schedulePart,
} from '@gather/core/finance'
import { useMutation, useQuery } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeSheet } from '../../components/NativeSheet'
import { Segmented } from '../../components/Segmented'
import { fmt } from '../../i18n'
import { termWords, toLoanPart, toLoanParts } from './loanParts'
import type { FinanceBase } from './paths'
import {
  AddRow,
  AnswerBar,
  Card,
  Chip,
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

type Editing =
  | 'amount'
  | 'rate'
  | 'fixedUntil'
  | 'term'
  | 'expiryRate'
  | 'repayment'
  | 'charge'
  | null

export function LoanPartScreen({
  base: _base,
  partId,
}: {
  base: FinanceBase
  partId: Id<'loanParts'>
}) {
  const tokens = useMoneyTokens()
  const router = useRouter()
  const { groupSlug, format, text, today } = useFinances()

  // The part is read through its calculation: one query answers both what this
  // part is and what the whole mortgage costs, which the bar needs anyway.
  const part = useQuery(api.mortgages.getPart, { id: partId, groupSlug })
  const calculation = useQuery(
    api.mortgages.get,
    part ? { id: part.calculationId, groupSlug } : 'skip',
  )
  const updatePart = useMutation(api.mortgages.updatePart)
  const removePart = useMutation(api.mortgages.removePart)

  const [editing, setEditing] = useState<Editing>(null)
  const [draft, setDraft] = useState('')
  const [repaymentKind, setRepaymentKind] = useState<'once' | 'monthly'>(
    'monthly',
  )
  const [repaymentDate, setRepaymentDate] = useState(today)
  const [freeAnnual, setFreeAnnual] = useState('10')

  if (part === undefined || calculation === undefined) {
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
  if (part === null || calculation === null) {
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

  const index = calculation.parts.findIndex((row) => row._id === partId)
  const title = fmt(text.loanPart.title, { index: index + 1 })
  const schedule = schedulePart(toLoanPart(part, today))
  const allTotals = calculationTotals(toLoanParts(calculation.parts, today))

  /** Every write sends the whole part, because `updatePart` takes the whole part. */
  function write(patch: Partial<NonNullable<typeof part>>) {
    if (!part) return
    updatePart({
      id: partId,
      groupSlug,
      kind: patch.kind ?? part.kind,
      principalCents: patch.principalCents ?? part.principalCents,
      annualRatePercent: patch.annualRatePercent ?? part.annualRatePercent,
      termMonths: patch.termMonths ?? part.termMonths,
      fixedUntil: 'fixedUntil' in patch ? patch.fixedUntil : part.fixedUntil,
      expiryRatePercent:
        'expiryRatePercent' in patch
          ? patch.expiryRatePercent
          : part.expiryRatePercent,
      expiryRateOptions: patch.expiryRateOptions ?? part.expiryRateOptions,
      repayments: patch.repayments ?? part.repayments,
      charge: 'charge' in patch ? patch.charge : part.charge,
    })
  }

  const numeric = () => Number(draft.trim().replace(',', '.'))

  // Narrowed once, above the closures: the queries resolved before this point,
  // and TypeScript cannot see that through a function boundary.
  const current = part

  function save() {
    const value = draft.trim()
    if (editing === 'amount') {
      const cents = Math.round(numeric() * 100)
      if (Number.isFinite(cents) && cents > 0) write({ principalCents: cents })
    }
    if (editing === 'rate') {
      const rate = numeric()
      if (Number.isFinite(rate) && rate >= 0 && rate <= 100)
        write({ annualRatePercent: rate })
    }
    if (editing === 'term') {
      const years = numeric()
      if (Number.isFinite(years) && years > 0)
        write({ termMonths: Math.round(years * 12) })
    }
    if (editing === 'fixedUntil') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) write({ fixedUntil: value })
    }
    if (editing === 'expiryRate') {
      const rate = numeric()
      if (Number.isFinite(rate) && rate >= 0 && rate <= 100) {
        const options = [
          ...new Set([...(current.expiryRateOptions ?? []), rate]),
        ]
        write({ expiryRateOptions: options, expiryRatePercent: rate })
      }
    }
    if (editing === 'repayment') {
      const cents = Math.round(numeric() * 100)
      if (Number.isFinite(cents) && cents > 0) {
        write({
          repayments: [
            ...(current.repayments ?? []),
            { kind: repaymentKind, amountCents: cents, date: repaymentDate },
          ],
        })
      }
    }
    if (editing === 'charge') {
      const rate = numeric()
      const free = Number(freeAnnual.replace(',', '.'))
      if (Number.isFinite(rate) && Number.isFinite(free))
        write({ charge: { freeAnnualPercent: free, chargePercent: rate } })
    }
    setDraft('')
    setEditing(null)
  }

  function removeRepayment(at: number) {
    write({
      repayments: (part?.repayments ?? []).filter((_, i) => i !== at),
    })
  }

  function confirmDelete() {
    Alert.alert(title, text.errors.confirmDeleteBody, [
      { text: text.actions.cancel, style: 'cancel' },
      {
        text: text.actions.delete,
        style: 'destructive',
        onPress: () => {
          removePart({ id: partId, groupSlug })
          router.back()
        },
      },
    ])
  }

  // What this part costs in the month the fix ends, which is the month after
  // the last fixed one. Past the end of the schedule it is what it costs now:
  // a part that is paid off before its fix expires never sees the new rate.
  const fixEndsIn = part.fixedUntil ? monthsUntil(today, part.fixedUntil) : 0
  const paymentAfterFix =
    schedule.paymentByMonth[fixEndsIn] ?? schedule.monthlyPaymentCents

  const rateOptions = [
    ...new Set([...(part.expiryRateOptions ?? []), part.annualRatePercent]),
  ].sort((a, b) => a - b)

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title }} />
      <ScreenScroll bottomInset={90}>
        <View style={styles.segment}>
          <Segmented<LoanPartKind>
            options={LOAN_PART_KINDS.map((kind) => ({
              value: kind,
              label: text.loanPartKinds[kind],
            }))}
            value={part.kind}
            onChange={(kind) => write({ kind })}
          />
        </View>

        <Card>
          <Row
            label={text.loanPart.amount}
            value={format.money(part.principalCents, { decimals: false })}
            emphasis
            chevron
            onPress={() => {
              setDraft(String(part.principalCents / 100))
              setEditing('amount')
            }}
          />
          <Row
            label={text.loanPart.interest}
            value={format.percent(part.annualRatePercent)}
            emphasis
            chevron
            onPress={() => {
              setDraft(String(part.annualRatePercent))
              setEditing('rate')
            }}
          />
          <Row
            label={text.loanPart.fixedUntil}
            value={
              part.fixedUntil
                ? format.month(part.fixedUntil)
                : text.loanPart.fixedUntilUnset
            }
            chevron
            onPress={() => {
              setDraft(part.fixedUntil ?? today)
              setEditing('fixedUntil')
            }}
          />
          <Row
            label={text.loanPart.remainingTerm}
            value={termWords(part.termMonths, text.loanPart)}
            chevron
            last
            onPress={() => {
              setDraft(String(Math.round(part.termMonths / 12)))
              setEditing('term')
            }}
          />
        </Card>

        {part.fixedUntil ? (
          <>
            <Section title={text.loanPart.whenFixEnds} />
            <Card padded>
              <Notice>{text.loanPart.ifRateBecomes}</Notice>
              <View style={styles.chips}>
                {rateOptions.map((rate) => (
                  <Chip
                    key={rate}
                    label={format.percent(rate)}
                    selected={
                      (part.expiryRatePercent ?? part.annualRatePercent) ===
                      rate
                    }
                    onPress={() => write({ expiryRatePercent: rate })}
                  />
                ))}
                <Chip
                  label={text.loanPart.addRate}
                  selected={false}
                  onPress={() => {
                    setDraft('')
                    setEditing('expiryRate')
                  }}
                />
              </View>
            </Card>
            <Card>
              <Row
                label={fmt(text.loanPart.fromDate, {
                  date: format.month(part.fixedUntil),
                })}
                value={format.money(paymentAfterFix, { decimals: false })}
                emphasis
                last
              />
            </Card>
          </>
        ) : null}

        <Section title={text.loanPart.repayments} />
        <Card>
          {(part.repayments ?? []).map((repayment, at) => (
            <Row
              key={`${repayment.date}-${at}`}
              label={fmt(
                repayment.kind === 'once'
                  ? text.loanPart.onceSummary
                  : text.loanPart.monthlySummary,
                { amount: format.money(repayment.amountCents) },
              )}
              sub={fmt(text.loanPart.fromMonth, {
                date: format.date(repayment.date),
              })}
              value={text.actions.delete}
              onPress={() => removeRepayment(at)}
            />
          ))}
          <AddRow
            label={text.loanPart.addRepayment}
            onPress={() => {
              setDraft('')
              setRepaymentDate(today)
              setEditing('repayment')
            }}
            last={false}
          />
          <Row
            label={text.loanPart.charge}
            sub={
              part.charge
                ? fmt(text.loanPart.chargeSummary, {
                    free: part.charge.freeAnnualPercent,
                    rate: part.charge.chargePercent,
                  })
                : text.loanPart.chargeUnset
            }
            chevron
            last
            onPress={() => {
              setFreeAnnual(String(part.charge?.freeAnnualPercent ?? 10))
              setDraft(String(part.charge?.chargePercent ?? ''))
              setEditing('charge')
            }}
          />
        </Card>

        <Notice>{text.loanPart.notice}</Notice>
        <PrimaryButton label={text.actions.delete} onPress={confirmDelete} />
        <Disclaimer />
      </ScreenScroll>

      <AnswerBar
        amount={format.money(schedule.monthlyPaymentCents, { decimals: false })}
        unit={text.recurringCosts.aMonth}
        sub={`${text.loanPart.barThisPart} · ${fmt(text.loanPart.barAll, {
          amount: format.money(allTotals.monthlyCents, { decimals: false }),
        })}`}
      />

      {editing ? (
        <NativeSheet
          title={sheetTitle(editing, text)}
          onClose={() => setEditing(null)}
          footer={
            <PrimaryButton
              label={text.actions.save}
              onPress={save}
              disabled={draft.trim().length === 0}
            />
          }
        >
          {editing === 'repayment' ? (
            <View style={styles.segment}>
              <Segmented<'once' | 'monthly'>
                options={[
                  { value: 'monthly', label: text.loanPart.repaymentMonthly },
                  { value: 'once', label: text.loanPart.repaymentOnce },
                ]}
                value={repaymentKind}
                onChange={setRepaymentKind}
              />
            </View>
          ) : null}
          {editing === 'charge' ? (
            <Field
              label={text.loanPart.freeAnnual}
              value={freeAnnual}
              onChangeText={setFreeAnnual}
              keyboardType="decimal-pad"
              suffix="%"
            />
          ) : null}
          <Field
            label={sheetTitle(editing, text)}
            value={draft}
            onChangeText={setDraft}
            keyboardType={
              editing === 'fixedUntil'
                ? 'numbers-and-punctuation'
                : 'decimal-pad'
            }
            autoFocus
          />
          {editing === 'repayment' ? (
            <Field
              label={text.loanPart.fromMonth.replace('{date}', '').trim()}
              value={repaymentDate}
              onChangeText={setRepaymentDate}
              keyboardType="numbers-and-punctuation"
            />
          ) : null}
        </NativeSheet>
      ) : null}
    </>
  )
}

function sheetTitle(
  editing: NonNullable<Editing>,
  text: ReturnType<typeof useFinances>['text'],
): string {
  switch (editing) {
    case 'amount':
      return text.loanPart.amount
    case 'rate':
      return text.loanPart.interest
    case 'fixedUntil':
      return text.loanPart.fixedUntil
    case 'term':
      return text.loanPart.remainingTerm
    case 'expiryRate':
      return text.loanPart.addRate
    case 'repayment':
      return text.loanPart.addRepayment
    case 'charge':
      return text.loanPart.chargeRate
  }
}

const styles = StyleSheet.create({
  segment: { paddingVertical: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
})
