/**
 * Shared costs — the only disposable calculator left in the Module (ADR-0025).
 *
 * Every figure on this screen lives in component state and nowhere else. Closing
 * it loses the calculation, on purpose: it creates no debt, no balance, no
 * settlement and no history, and the closing notice says so because a screen
 * that lists "Sam pays Rae €65" otherwise reads exactly like one that does.
 *
 * Saving is the exception, and a saved split is immutable — the frozen figures
 * go to the database, not the inputs, so a scenario cannot quietly recalculate
 * itself after somebody leaves the Group.
 */

import { splitEvent, toCents } from '@gather/core/finance'
import { useMutation, useQuery } from 'convex/react'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeSheet } from '../../components/NativeSheet'
import { Segmented } from '../../components/Segmented'
import { fmt } from '../../i18n'
import { FINANCE_ICONS } from './icons'
import type { FinanceBase } from './paths'
import {
  AddRow,
  AnswerBar,
  Card,
  Chip,
  Disclaimer,
  EmptyState,
  Field,
  Notice,
  PrimaryButton,
  Row,
  ScreenScroll,
  Section,
  useMoneyTokens,
} from './ui'
import { useFinances } from './useFinances'

interface Payment {
  memberId: string
  amountCents: number
  label?: string
}

export function SplitScreen({ base: _base }: { base: FinanceBase }) {
  const tokens = useMoneyTokens()
  const { groupSlug, format, text } = useFinances()
  const members = useQuery(api.groups.members, { slug: groupSlug })
  const saved = useQuery(api.splitScenarios.list, { groupSlug })
  const saveScenario = useMutation(api.splitScenarios.save)

  const [what, setWhat] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const [participants, setParticipants] = useState<string[]>([])
  const [mode, setMode] = useState<'equal' | 'custom'>('equal')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [payer, setPayer] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [name, setName] = useState('')

  const tint = tokens.tintOf('money')
  const Users = FINANCE_ICONS.Users

  if (members === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.split.title }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={4} label={text.actions.loading} />
        </View>
      </>
    )
  }

  // Narrowed once: the query resolved above, and TypeScript cannot see that
  // through the closures below.
  const roster = members
  const nameOf = (userId: string) =>
    roster.find((member) => member.userId === userId)?.name ?? ''

  const result = splitEvent({
    payments,
    participantIds:
      participants.length > 0
        ? participants
        : members.map((member) => member.userId),
    mode,
  })

  function addPayment() {
    const cents = toCents(Number(amount.replace(',', '.')))
    if (!payer || !Number.isFinite(cents) || cents <= 0) return
    setPayments((current) => [
      ...current,
      { memberId: payer, amountCents: cents, label: label.trim() || undefined },
    ])
    setAmount('')
    setLabel('')
    setPayer(null)
    setAdding(false)
  }

  function save() {
    const trimmed = name.trim() || what.trim()
    if (!trimmed || payments.length === 0) return
    const ids =
      participants.length > 0
        ? participants
        : roster.map((member) => member.userId)
    saveScenario({
      groupSlug,
      name: trimmed,
      payments: payments.map((payment) => ({
        party: {
          userId: payment.memberId as never,
          name: nameOf(payment.memberId),
        },
        amountCents: payment.amountCents,
        label: payment.label,
      })),
      participants: ids.map((id) => ({
        userId: id as never,
        name: nameOf(id),
      })),
      mode,
      owed: ids.map((id) => ({
        party: { userId: id as never, name: nameOf(id) },
        amountCents: result.owedCents.get(id) ?? 0,
      })),
      transfers: result.transfers.map((transfer) => ({
        from: {
          userId: transfer.fromMemberId as never,
          name: nameOf(transfer.fromMemberId),
        },
        to: {
          userId: transfer.toMemberId as never,
          name: nameOf(transfer.toMemberId),
        },
        amountCents: transfer.amountCents,
      })),
      totalCents: result.totalCents,
    })
    setSaving(false)
    setName('')
  }

  const each =
    result.owedCents.size > 0
      ? (result.owedCents.values().next().value ?? 0)
      : 0

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: text.split.title }} />
      <ScreenScroll bottomInset={payments.length > 0 ? 90 : 24}>
        <Card padded>
          <Field
            label={text.split.what}
            value={what}
            onChangeText={setWhat}
            placeholder={text.split.whatPlaceholder}
          />
        </Card>

        <Section title={text.split.whoPaid} />
        <Card>
          {payments.map((payment, index) => (
            <Row
              key={`${payment.memberId}-${index}`}
              label={nameOf(payment.memberId)}
              sub={payment.label}
              value={format.money(payment.amountCents)}
              emphasis
              onPress={() =>
                setPayments((current) => current.filter((_, i) => i !== index))
              }
            />
          ))}
          <AddRow
            label={text.split.addPayment}
            onPress={() => {
              setPayer(members[0]?.userId ?? null)
              setAdding(true)
            }}
          />
        </Card>

        {payments.length === 0 ? (
          <EmptyState
            icon={<Users size={34} color={tint.fg} strokeWidth={1.6} />}
            title={text.split.emptyTitle}
            body={text.split.emptyBody}
          />
        ) : (
          <>
            <Section title={text.split.splitBetween} />
            <View style={styles.chips}>
              {members.map((member) => {
                const included =
                  participants.length === 0 ||
                  participants.includes(member.userId)
                return (
                  <Chip
                    key={member.userId}
                    label={member.name}
                    selected={included}
                    onPress={() => {
                      const current =
                        participants.length > 0
                          ? participants
                          : members.map((row) => row.userId)
                      setParticipants(
                        current.includes(member.userId)
                          ? current.filter((id) => id !== member.userId)
                          : [...current, member.userId],
                      )
                    }}
                  />
                )
              })}
            </View>
            <View style={styles.segment}>
              <Segmented<'equal' | 'custom'>
                options={[
                  { value: 'equal', label: text.split.equally },
                  { value: 'custom', label: text.split.custom },
                ]}
                value={mode}
                onChange={setMode}
              />
            </View>

            <Section title={text.split.toSettle} />
            <Card>
              {result.transfers.length === 0 ? (
                <Row label={text.split.settled} last />
              ) : (
                result.transfers.map((transfer, index) => (
                  <Row
                    key={`${transfer.fromMemberId}-${transfer.toMemberId}`}
                    label={fmt(text.split.pays, {
                      from: nameOf(transfer.fromMemberId),
                      to: nameOf(transfer.toMemberId),
                    })}
                    value={format.money(transfer.amountCents)}
                    emphasis
                    last={index === result.transfers.length - 1}
                  />
                ))
              )}
            </Card>
          </>
        )}

        {saved && saved.length > 0 ? (
          <>
            <Section title={text.split.saved} />
            <Card>
              {saved.map((scenario, index) => (
                <Row
                  key={scenario._id}
                  label={scenario.name}
                  sub={scenario.transfers
                    .map((transfer) =>
                      fmt(text.split.pays, {
                        from: transfer.from.name,
                        to: transfer.to.name,
                      }),
                    )
                    .join(' · ')}
                  value={format.money(scenario.totalCents)}
                  emphasis
                  last={index === saved.length - 1}
                />
              ))}
            </Card>
            <Notice>{text.split.immutable}</Notice>
          </>
        ) : null}

        <Notice>{text.split.notice}</Notice>
        <Disclaimer />
      </ScreenScroll>

      {payments.length > 0 ? (
        <AnswerBar
          amount={format.money(each)}
          unit={text.split.barEach}
          sub={fmt(text.split.barSub, {
            total: format.money(result.totalCents),
            count: result.owedCents.size,
          })}
          action={
            <PrimaryButton
              label={text.split.saveThis}
              onPress={() => {
                setName(what)
                setSaving(true)
              }}
            />
          }
        />
      ) : null}

      {adding ? (
        <NativeSheet
          title={text.split.addPayment}
          onClose={() => setAdding(false)}
          footer={
            <PrimaryButton
              label={text.actions.add}
              onPress={addPayment}
              disabled={!payer || amount.trim().length === 0}
            />
          }
        >
          <View style={styles.chips}>
            {members.map((member) => (
              <Chip
                key={member.userId}
                label={member.name}
                selected={payer === member.userId}
                onPress={() => setPayer(member.userId)}
              />
            ))}
          </View>
          <Field
            label={text.recurringCosts.cost.amount}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoFocus
          />
          <Field
            label={text.split.paymentFor}
            value={label}
            onChangeText={setLabel}
          />
        </NativeSheet>
      ) : null}

      {saving ? (
        <NativeSheet
          title={text.split.saveThis}
          subtitle={text.split.immutable}
          onClose={() => setSaving(false)}
          footer={
            <PrimaryButton
              label={text.actions.save}
              onPress={save}
              disabled={name.trim().length === 0}
            />
          }
        >
          <Field
            label={text.split.saveName}
            value={name}
            onChangeText={setName}
            placeholder={text.split.whatPlaceholder}
            autoFocus
          />
        </NativeSheet>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { paddingVertical: 6 },
})
