/**
 * One House: what its mortgage costs, the calculations under it, and the three
 * things about the house itself.
 *
 * The summary card at the top is the *first* calculation's totals rather than a
 * figure of its own — a House does not have a mortgage, it has calculations,
 * and the one the Group put first is the one they mean by "what we pay".
 */

import { calculationTotals, homeBuyingCosts } from '@gather/core/finance'
import { useMutation, useQuery } from 'convex/react'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeSheet } from '../../components/NativeSheet'
import { fmt } from '../../i18n'
import { FINANCE_ICONS } from './icons'
import { toLoanParts } from './loanParts'
import { type FinanceBase, financeHref } from './paths'
import {
  AddRow,
  Card,
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

type Editing = 'calculation' | 'value' | 'bought' | null

export function HouseScreen({
  base,
  houseId,
}: {
  base: FinanceBase
  houseId: Id<'houses'>
}) {
  const tokens = useMoneyTokens()
  const router = useRouter()
  const { groupSlug, format, text, today } = useFinances()
  const house = useQuery(api.houses.get, { id: houseId, groupSlug })
  const createCalculation = useMutation(api.mortgages.create)
  const updateHouse = useMutation(api.houses.update)
  const removeHouse = useMutation(api.houses.remove)

  const [editing, setEditing] = useState<Editing>(null)
  const [draft, setDraft] = useState('')

  const tint = tokens.tintOf('money')
  const Key = FINANCE_ICONS.Key
  const Clock = FINANCE_ICONS.Clock

  if (house === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.house.fallbackName }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={4} label={text.actions.loading} />
        </View>
      </>
    )
  }

  // A House in another Group and a House that never existed are the same
  // answer, so this is the same screen for both.
  if (house === null) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.house.fallbackName }}
        />
        <ScreenScroll>
          <Notice>{text.errors.confirmDeleteBody}</Notice>
        </ScreenScroll>
      </>
    )
  }

  const buyingCosts = house.buyingCosts
    ? homeBuyingCosts(house.buyingCosts)
    : null
  const first = house.calculations[0]
  const totals = first ? calculationTotals(toLoanParts(first.parts)) : null
  const nextFix = house.calculations
    .flatMap((calculation) => calculation.parts)
    .map((part) => part.fixedUntil)
    .filter((date): date is string => typeof date === 'string' && date > today)
    .sort()[0]

  function save() {
    const value = draft.trim()
    if (editing === 'calculation') {
      if (!value) return
      createCalculation({ houseId, groupSlug, name: value })
    }
    if (editing === 'value') {
      const cents = Math.round(Number(value.replace(',', '.')) * 100)
      if (!Number.isFinite(cents) || cents < 0) return
      updateHouse({ id: houseId, groupSlug, valueCents: cents })
    }
    if (editing === 'bought') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return
      updateHouse({ id: houseId, groupSlug, boughtOn: value })
    }
    setDraft('')
    setEditing(null)
  }

  function confirmDelete() {
    Alert.alert(
      fmt(text.errors.confirmDelete, { name: house?.name ?? '' }),
      text.errors.confirmDeleteBody,
      [
        { text: text.actions.cancel, style: 'cancel' },
        {
          text: text.actions.delete,
          style: 'destructive',
          onPress: () => {
            removeHouse({ id: houseId, groupSlug })
            router.back()
          },
        },
      ],
    )
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: house.name }} />
      <ScreenScroll>
        {totals ? (
          <Card padded>
            <Figure
              caption={text.house.summaryCaption}
              amount={format.money(totals.monthlyCents, { decimals: false })}
              sub={fmt(text.house.summarySub, {
                parts:
                  first.parts.length === 1
                    ? text.index.onePart
                    : fmt(text.index.partCount, { count: first.parts.length }),
                outstanding: format.money(totals.outstandingCents, {
                  decimals: false,
                }),
              })}
            />
            {nextFix ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 6,
                }}
              >
                <Clock size={13} color={tokens.muted} strokeWidth={1.8} />
                <Notice>
                  {fmt(text.house.firstFixEnds, {
                    date: format.month(nextFix),
                  })}
                </Notice>
              </View>
            ) : null}
          </Card>
        ) : null}

        <Section title={text.house.calculations} />
        <Card>
          {house.calculations.map((calculation) => {
            const each = calculationTotals(toLoanParts(calculation.parts))
            return (
              <Row
                key={calculation._id}
                label={calculation.name}
                sub={[
                  calculation.parts.length === 1
                    ? text.index.onePart
                    : fmt(text.index.partCount, {
                        count: calculation.parts.length,
                      }),
                  calculation.updatedByName ?? '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                value={
                  calculation.parts.length > 0
                    ? format.money(each.monthlyCents, { decimals: false })
                    : undefined
                }
                emphasis
                chevron
                onPress={() =>
                  router.push(
                    financeHref(base, '/mortgage', {
                      calculationId: calculation._id,
                    }),
                  )
                }
              />
            )
          })}
          <AddRow
            label={text.house.addCalculation}
            onPress={() => {
              setDraft('')
              setEditing('calculation')
            }}
          />
        </Card>

        <Section title={text.house.theHouse} />
        <Card>
          <Row
            label={text.house.value}
            sub={
              house.valueAsOf
                ? fmt(text.house.valueSub, {
                    date: format.date(house.valueAsOf),
                  })
                : undefined
            }
            value={
              house.valueCents !== undefined
                ? format.money(house.valueCents, { decimals: false })
                : text.house.valueUnset
            }
            emphasis={house.valueCents !== undefined}
            chevron
            onPress={() => {
              setDraft(
                house.valueCents !== undefined
                  ? String(house.valueCents / 100)
                  : '',
              )
              setEditing('value')
            }}
          />
          <Row
            label={text.house.bought}
            value={
              house.boughtOn
                ? format.date(house.boughtOn)
                : text.house.boughtUnset
            }
            chevron
            onPress={() => {
              setDraft(house.boughtOn ?? today)
              setEditing('bought')
            }}
          />
          <Row
            leading={<Key size={20} color={tint.fg} strokeWidth={1.8} />}
            label={text.house.buyingCosts}
            sub={
              buyingCosts
                ? fmt(text.house.buyingCostsSub, {
                    cash: format.money(buyingCosts.cashNeededCents, {
                      decimals: false,
                    }),
                  })
                : text.house.buyingCostsUnset
            }
            chevron
            last
            onPress={() =>
              router.push(financeHref(base, '/buying-costs', { houseId }))
            }
          />
        </Card>

        <Notice>{text.house.notice}</Notice>
        <PrimaryButton label={text.actions.delete} onPress={confirmDelete} />
        <Disclaimer />
      </ScreenScroll>

      {editing ? (
        <NativeSheet
          title={
            editing === 'calculation'
              ? text.house.addCalculation
              : editing === 'value'
                ? text.house.value
                : text.house.bought
          }
          onClose={() => setEditing(null)}
          footer={
            <PrimaryButton
              label={text.actions.save}
              onPress={save}
              disabled={draft.trim().length === 0}
            />
          }
        >
          <Field
            label={
              editing === 'calculation'
                ? text.house.nameLabel
                : editing === 'value'
                  ? text.house.value
                  : text.house.bought
            }
            value={draft}
            onChangeText={setDraft}
            placeholder={
              editing === 'calculation'
                ? text.house.calculationNamePlaceholder
                : editing === 'bought'
                  ? today
                  : undefined
            }
            keyboardType={editing === 'value' ? 'decimal-pad' : 'default'}
            autoFocus
          />
        </NativeSheet>
      ) : null}
    </>
  )
}
