/**
 * One recurring cost: the two figures, the four fields, and who pays what.
 *
 * This is where the struck Subscription comparison tool's job lands (ADR-0025).
 * Comparing what this cost could be bought for belongs beside the cost itself
 * rather than in a tool of its own, so the screen says so and leaves the room
 * for it rather than pretending the idea went away.
 */

import {
  annualCents,
  monthlyCents,
  shareOf,
  splitTotalsToHundred,
} from '@gather/core/finance'
import { useMutation, useQuery } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeSheet } from '../../components/NativeSheet'
import { fmt } from '../../i18n'
import type { FinanceBase } from './paths'
import {
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
  useMoneyTokens,
} from './ui'
import { useFinances } from './useFinances'

type Editing = 'amount' | 'frequency' | 'category' | 'note' | 'split' | null

export function RecurringCostScreen({
  base: _base,
  costId,
}: {
  base: FinanceBase
  costId: Id<'recurringCosts'>
}) {
  const tokens = useMoneyTokens()
  const router = useRouter()
  const { groupSlug, format, text } = useFinances()
  const cost = useQuery(api.recurringCosts.get, { id: costId, groupSlug })
  const members = useQuery(api.groups.members, { slug: groupSlug })
  const update = useMutation(api.recurringCosts.update)
  const remove = useMutation(api.recurringCosts.remove)

  const [editing, setEditing] = useState<Editing>(null)
  const [draft, setDraft] = useState('')
  const [percents, setPercents] = useState<Record<string, string>>({})

  if (cost === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.recurringCosts.title }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={4} label={text.actions.loading} />
        </View>
      </>
    )
  }
  if (cost === null) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.recurringCosts.title }}
        />
        <ScreenScroll>
          <Notice>{text.recurringCosts.emptyBody}</Notice>
        </ScreenScroll>
      </>
    )
  }

  const perMonth = monthlyCents(cost)
  const split = (cost.split ?? []).map((share) => ({
    memberId: share.userId as string,
    percent: share.percent,
  }))
  const shares = shareOf(perMonth, split)

  function write(patch: Partial<NonNullable<typeof cost>>) {
    if (!cost) return
    update({
      id: costId,
      groupSlug,
      name: patch.name ?? cost.name,
      amountCents: patch.amountCents ?? cost.amountCents,
      frequency: patch.frequency ?? cost.frequency,
      category: patch.category ?? cost.category,
      note: 'note' in patch ? patch.note : cost.note,
      split: patch.split ?? cost.split,
    })
  }

  function saveSplit() {
    const next = Object.entries(percents)
      .map(([userId, value]) => ({
        userId: userId as Id<'users'>,
        percent: Number(value.replace(',', '.')) || 0,
      }))
      .filter((share) => share.percent > 0)
    if (
      !splitTotalsToHundred(
        next.map((share) => ({
          memberId: share.userId,
          percent: share.percent,
        })),
      )
    )
      return
    write({ split: next })
    setEditing(null)
  }

  function confirmDelete() {
    Alert.alert(
      fmt(text.errors.confirmDelete, { name: cost?.name ?? '' }),
      text.errors.confirmDeleteBody,
      [
        { text: text.actions.cancel, style: 'cancel' },
        {
          text: text.actions.delete,
          style: 'destructive',
          onPress: () => {
            remove({ id: costId, groupSlug })
            router.back()
          },
        },
      ],
    )
  }

  const splitTotal = Object.values(percents).reduce(
    (sum, value) => sum + (Number(value.replace(',', '.')) || 0),
    0,
  )

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: cost.name }} />
      <ScreenScroll>
        <Card padded>
          <View style={styles.headline}>
            <View style={styles.half}>
              <Figure
                caption={text.recurringCosts.perMonth}
                amount={format.money(perMonth)}
              />
            </View>
            <View style={styles.half}>
              <Figure
                caption={text.recurringCosts.perYear}
                amount={format.money(annualCents(cost))}
                large={false}
              />
            </View>
          </View>
        </Card>

        <Section title={text.recurringCosts.cost.theCost} />
        <Card>
          <Row
            label={text.recurringCosts.cost.amount}
            value={format.money(cost.amountCents)}
            emphasis
            chevron
            onPress={() => {
              setDraft(String(cost.amountCents / 100))
              setEditing('amount')
            }}
          />
          <Row
            label={text.recurringCosts.cost.howOften}
            value={text.frequencies[cost.frequency]}
            chevron
            onPress={() => setEditing('frequency')}
          />
          <Row
            label={text.recurringCosts.cost.category}
            value={text.categories[cost.category]}
            chevron
            onPress={() => setEditing('category')}
          />
          <Row
            label={text.recurringCosts.cost.note}
            sub={cost.note ?? text.recurringCosts.cost.noteUnset}
            chevron
            last
            onPress={() => {
              setDraft(cost.note ?? '')
              setEditing('note')
            }}
          />
        </Card>

        <Section title={text.recurringCosts.cost.whoPays} />
        <Card>
          {(members ?? []).map((member) => {
            const share = split.find((row) => row.memberId === member.userId)
            return (
              <Row
                key={member.userId}
                label={member.name}
                sub={share ? `${share.percent} %` : '0 %'}
                value={format.money(shares.get(member.userId) ?? 0)}
                emphasis={Boolean(share)}
              />
            )
          })}
          <Row
            label={text.recurringCosts.cost.changeSplit}
            chevron
            last
            onPress={() => {
              setPercents(
                Object.fromEntries(
                  (members ?? []).map((member) => [
                    member.userId,
                    String(
                      split.find((row) => row.memberId === member.userId)
                        ?.percent ?? 0,
                    ),
                  ]),
                ),
              )
              setEditing('split')
            }}
          />
        </Card>

        <Notice>{text.recurringCosts.cost.notice}</Notice>
        <Notice>{text.recurringCosts.cost.comparisonSoon}</Notice>
        <PrimaryButton label={text.actions.delete} onPress={confirmDelete} />
        <Disclaimer />
      </ScreenScroll>

      {editing === 'frequency' || editing === 'category' ? (
        <NativeSheet
          title={
            editing === 'frequency'
              ? text.recurringCosts.cost.howOften
              : text.recurringCosts.cost.category
          }
          onClose={() => setEditing(null)}
        >
          <View style={styles.chips}>
            {editing === 'frequency'
              ? (
                  [
                    'weekly',
                    'monthly',
                    'quarterly',
                    'halfYearly',
                    'yearly',
                  ] as const
                ).map((option) => (
                  <Chip
                    key={option}
                    label={text.frequencies[option]}
                    selected={cost.frequency === option}
                    onPress={() => {
                      write({ frequency: option })
                      setEditing(null)
                    }}
                  />
                ))
              : (
                  [
                    'housing',
                    'utilities',
                    'insurance',
                    'transport',
                    'health',
                    'media',
                    'other',
                  ] as const
                ).map((option) => (
                  <Chip
                    key={option}
                    label={text.categories[option]}
                    selected={cost.category === option}
                    onPress={() => {
                      write({ category: option })
                      setEditing(null)
                    }}
                  />
                ))}
          </View>
        </NativeSheet>
      ) : null}

      {editing === 'split' ? (
        <NativeSheet
          title={text.recurringCosts.cost.changeSplit}
          subtitle={text.errors.splitTotal}
          onClose={() => setEditing(null)}
          footer={
            <PrimaryButton
              label={text.actions.save}
              onPress={saveSplit}
              disabled={splitTotal !== 100}
            />
          }
        >
          {(members ?? []).map((member) => (
            <Field
              key={member.userId}
              label={member.name}
              value={percents[member.userId] ?? '0'}
              onChangeText={(next) =>
                setPercents((current) => ({
                  ...current,
                  [member.userId]: next,
                }))
              }
              keyboardType="decimal-pad"
              suffix="%"
            />
          ))}
        </NativeSheet>
      ) : null}

      {editing === 'amount' || editing === 'note' ? (
        <NativeSheet
          title={
            editing === 'amount'
              ? text.recurringCosts.cost.amount
              : text.recurringCosts.cost.note
          }
          onClose={() => setEditing(null)}
          footer={
            <PrimaryButton
              label={text.actions.save}
              onPress={() => {
                if (editing === 'amount') {
                  const cents = Math.round(
                    Number(draft.replace(',', '.')) * 100,
                  )
                  if (Number.isFinite(cents) && cents > 0)
                    write({ amountCents: cents })
                } else {
                  write({ note: draft.trim() || undefined })
                }
                setEditing(null)
              }}
            />
          }
        >
          <Field
            label={
              editing === 'amount'
                ? text.recurringCosts.cost.amount
                : text.recurringCosts.cost.note
            }
            value={draft}
            onChangeText={setDraft}
            keyboardType={editing === 'amount' ? 'decimal-pad' : 'default'}
            placeholder={
              editing === 'note'
                ? text.recurringCosts.cost.notePlaceholder
                : undefined
            }
            autoFocus
          />
        </NativeSheet>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  half: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
