/**
 * The Group's savings goals, and one of them.
 *
 * Two screens in one file because they are the same three figures at two zoom
 * levels: the list says how each goal is doing, and the goal says what a month
 * has to be to make its date. Both are calculated — nobody types "€478 a
 * month", they type a target and a date and Gather says the rest (ADR-0025).
 */

import { savingsProgress } from '@gather/core/finance'
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
import { type FinanceBase, financeHref } from './paths'
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

export function SavingsScreen({ base }: { base: FinanceBase }) {
  const tokens = useMoneyTokens()
  const router = useRouter()
  const { groupSlug, format, text, today } = useFinances()
  const goals = useQuery(api.savingsGoals.list, { groupSlug })
  const create = useMutation(api.savingsGoals.create)

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [date, setDate] = useState('')

  const tint = tokens.tintOf('money')
  const Target = FINANCE_ICONS.Target

  if (goals === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.savings.title }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={4} label={text.actions.loading} />
        </View>
      </>
    )
  }

  function open() {
    setName('')
    setTarget('')
    setDate('')
    setAdding(true)
  }

  function save() {
    const cents = Math.round(Number(target.replace(',', '.')) * 100)
    if (!name.trim() || !Number.isFinite(cents) || cents <= 0) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return
    create({
      groupSlug,
      name: name.trim(),
      targetCents: cents,
      targetDate: date,
    })
    setAdding(false)
  }

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: text.savings.title }}
      />
      <ScreenScroll>
        {goals.length === 0 ? (
          <EmptyState
            icon={<Target size={34} color={tint.fg} strokeWidth={1.6} />}
            title={text.savings.emptyTitle}
            body={text.savings.emptyBody}
            actionLabel={text.savings.addGoal}
            onAction={open}
          />
        ) : (
          <Card>
            {goals.map((goal) => {
              const progress = savingsProgress(goal, today)
              return (
                <Row
                  key={goal._id}
                  label={goal.name}
                  sub={fmt(text.savings.ofTargetBy, {
                    target: format.money(goal.targetCents, { decimals: false }),
                    date: format.month(goal.targetDate),
                  })}
                  value={format.money(goal.savedCents, { decimals: false })}
                  valueSub={
                    progress.reached
                      ? text.savings.reached
                      : fmt(text.savings.percentSaved, {
                          percent: Math.round(progress.fraction * 100),
                        })
                  }
                  valueTone={progress.behind ? 'down' : 'up'}
                  emphasis
                  chevron
                  onPress={() =>
                    router.push(
                      financeHref(base, '/goal', { goalId: goal._id }),
                    )
                  }
                />
              )
            })}
            <AddRow label={text.savings.addGoal} onPress={open} />
          </Card>
        )}

        <Notice>{text.savings.notice}</Notice>
        <Disclaimer />
      </ScreenScroll>

      {adding ? (
        <NativeSheet
          title={text.savings.addGoal}
          onClose={() => setAdding(false)}
          footer={<PrimaryButton label={text.actions.save} onPress={save} />}
        >
          <Field
            label={text.house.nameLabel}
            value={name}
            onChangeText={setName}
            placeholder={text.savings.namePlaceholder}
            autoFocus
          />
          <Field
            label={text.savings.target}
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
          />
          <Field
            label={text.savings.targetDate}
            value={date}
            onChangeText={setDate}
            placeholder={today}
            keyboardType="numbers-and-punctuation"
          />
        </NativeSheet>
      ) : null}
    </>
  )
}

type Editing = 'saved' | 'monthly' | null

export function SavingsGoalScreen({
  base: _base,
  goalId,
}: {
  base: FinanceBase
  goalId: Id<'savingsGoals'>
}) {
  const tokens = useMoneyTokens()
  const router = useRouter()
  const { groupSlug, format, text, today } = useFinances()
  const goal = useQuery(api.savingsGoals.get, { id: goalId, groupSlug })
  const update = useMutation(api.savingsGoals.update)
  const remove = useMutation(api.savingsGoals.remove)

  const [editing, setEditing] = useState<Editing>(null)
  const [draft, setDraft] = useState('')

  const tint = tokens.tintOf('money')

  if (goal === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.savings.title }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={3} label={text.actions.loading} />
        </View>
      </>
    )
  }
  if (goal === null) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.savings.title }}
        />
        <ScreenScroll>
          <Notice>{text.savings.emptyBody}</Notice>
        </ScreenScroll>
      </>
    )
  }

  const progress = savingsProgress(goal, today)

  function commit() {
    const cents = Math.round(Number(draft.replace(',', '.')) * 100)
    if (!Number.isFinite(cents) || cents < 0) {
      setEditing(null)
      return
    }
    if (editing === 'saved')
      update({ id: goalId, groupSlug, savedCents: cents })
    if (editing === 'monthly')
      update({ id: goalId, groupSlug, monthlyCents: cents })
    setEditing(null)
  }

  function confirmDelete() {
    Alert.alert(
      fmt(text.errors.confirmDelete, { name: goal?.name ?? '' }),
      text.errors.confirmDeleteBody,
      [
        { text: text.actions.cancel, style: 'cancel' },
        {
          text: text.actions.delete,
          style: 'destructive',
          onPress: () => {
            remove({ id: goalId, groupSlug })
            router.back()
          },
        },
      ],
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: goal.name }} />
      <ScreenScroll>
        <Card padded>
          <Figure
            amount={format.money(goal.savedCents, { decimals: false })}
            sub={fmt(text.savings.ofTargetBy, {
              target: format.money(goal.targetCents, { decimals: false }),
              date: format.month(goal.targetDate),
            })}
          />
          <View
            style={[styles.track, { backgroundColor: tokens.tile }]}
            accessible
            accessibilityLabel={fmt(text.savings.percentSaved, {
              percent: Math.round(progress.fraction * 100),
            })}
          >
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: tint.fg,
                  width: `${Math.round(progress.fraction * 100)}%`,
                },
              ]}
            />
          </View>
          <View style={styles.legend}>
            <Notice>
              {fmt(text.savings.percentSaved, {
                percent: Math.round(progress.fraction * 100),
              })}
            </Notice>
            <Notice>
              {fmt(text.savings.toGo, {
                amount: format.money(progress.remainingCents, {
                  decimals: false,
                }),
              })}
            </Notice>
          </View>
        </Card>

        <Section title={text.savings.whatItTakes} />
        <Card>
          <Row
            label={fmt(text.savings.toMake, {
              date: format.month(goal.targetDate),
            })}
            sub={
              progress.monthsRemaining === 0
                ? text.savings.thisMonthAlready
                : fmt(text.savings.monthsFromToday, {
                    count: progress.monthsRemaining,
                  })
            }
            value={
              progress.requiredMonthlyCents === null
                ? text.savings.reached
                : fmt(text.savings.perMonth, {
                    amount: format.money(progress.requiredMonthlyCents, {
                      decimals: false,
                    }),
                  })
            }
            emphasis
          />
          <Row
            label={
              goal.monthlyCents
                ? fmt(text.savings.atPace, {
                    amount: format.money(goal.monthlyCents, {
                      decimals: false,
                    }),
                  })
                : text.savings.noPace
            }
            sub={goal.monthlyCents ? text.savings.yourPace : undefined}
            value={
              progress.expectedDate
                ? format.month(progress.expectedDate)
                : undefined
            }
            valueSub={progress.behind ? text.savings.behind : undefined}
            valueTone="down"
            emphasis
            last
          />
        </Card>

        <Section title={text.savings.progress} />
        <Card>
          <Row
            label={text.savings.savedSoFar}
            sub={
              goal.updatedByName
                ? fmt(text.savings.updatedBy, {
                    date: format.date(today),
                    name: goal.updatedByName,
                  })
                : undefined
            }
            value={format.money(goal.savedCents, { decimals: false })}
            emphasis
            chevron
            onPress={() => {
              setDraft(String(goal.savedCents / 100))
              setEditing('saved')
            }}
          />
          <Row
            label={text.savings.puttingAside}
            sub={text.savings.puttingAsideSub}
            value={
              goal.monthlyCents
                ? format.money(goal.monthlyCents, { decimals: false })
                : text.savings.noPace
            }
            emphasis={Boolean(goal.monthlyCents)}
            chevron
            last
            onPress={() => {
              setDraft(String((goal.monthlyCents ?? 0) / 100))
              setEditing('monthly')
            }}
          />
        </Card>

        <Notice>{text.savings.notice}</Notice>
        <PrimaryButton label={text.actions.delete} onPress={confirmDelete} />
        <Disclaimer />
      </ScreenScroll>

      {editing ? (
        <NativeSheet
          title={
            editing === 'saved'
              ? text.savings.savedSoFar
              : text.savings.puttingAside
          }
          onClose={() => setEditing(null)}
          footer={<PrimaryButton label={text.actions.save} onPress={commit} />}
        >
          <Field
            label={
              editing === 'saved'
                ? text.savings.savedSoFar
                : text.savings.puttingAside
            }
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            autoFocus
          />
        </NativeSheet>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  track: { height: 10, borderRadius: 6, overflow: 'hidden', marginTop: 11 },
  fill: { height: 10, borderRadius: 6 },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
})
