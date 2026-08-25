/**
 * What buying this House costs beyond the price of it. Netherlands only.
 *
 * Every fee is a figure the Member entered — Gather knows no notary's tariff —
 * so the screen's job is the shape of the sum, not the numbers in it. The
 * highlighted card at the end says whether the household's own money covers it,
 * and says in the same breath that this is arithmetic and not an assessment of
 * what they can afford.
 */

import {
  BUYING_COST_LINES,
  type BuyingCostLine,
  homeBuyingCosts,
  TRANSFER_TAX_BANDS,
  type TransferTaxBand,
} from '@gather/core/finance'
import { useMutation, useQuery } from 'convex/react'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { NativeSheet } from '../../components/NativeSheet'
import { fmt } from '../../i18n'
import { FINANCE_ICONS } from './icons'
import { termWords } from './loanParts'
import type { FinanceBase } from './paths'
import {
  AnswerBar,
  Card,
  Chip,
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

/** The percentage each band carried when this screen was written. */
const BAND_PERCENT: Record<TransferTaxBand, number> = {
  starter: 0,
  ownHome: 2,
  other: 10.4,
}

type Editing =
  | BuyingCostLine
  | 'price'
  | 'ownMoney'
  | 'mortgage'
  | 'rate'
  | 'nhg'
  | null

export function BuyingCostsScreen({
  base: _base,
  houseId,
}: {
  base: FinanceBase
  houseId: Id<'houses'>
}) {
  const tokens = useMoneyTokens()
  const { groupSlug, format, text } = useFinances()
  const house = useQuery(api.houses.get, { id: houseId, groupSlug })
  const save = useMutation(api.houses.saveBuyingCosts)

  const [editing, setEditing] = useState<Editing>(null)
  const [draft, setDraft] = useState('')

  const tint = tokens.tintOf('money')
  const Key = FINANCE_ICONS.Key

  if (house === undefined) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.buyingCosts.title }}
        />
        <View style={{ flex: 1, backgroundColor: tokens.bg }}>
          <LoadingSkeleton rows={4} label={text.actions.loading} />
        </View>
      </>
    )
  }

  const stored = house?.buyingCosts ?? null

  function start() {
    save({
      houseId,
      groupSlug,
      purchasePriceCents: 0,
      ownMoneyCents: 0,
      mortgageCents: 0,
      mortgageRatePercent: 4,
      mortgageTermMonths: 360,
      transferTaxBand: 'ownHome',
      transferTaxPercent: BAND_PERCENT.ownHome,
    })
  }

  if (!stored) {
    return (
      <>
        <Stack.Screen
          options={{ headerShown: true, title: text.buyingCosts.title }}
        />
        <ScreenScroll>
          <EmptyState
            icon={<Key size={34} color={tint.fg} strokeWidth={1.6} />}
            title={text.buyingCosts.title}
            body={text.buyingCosts.emptyBody}
            actionLabel={text.buyingCosts.start}
            onAction={start}
          />
          <Disclaimer />
        </ScreenScroll>
      </>
    )
  }

  const result = homeBuyingCosts(stored)

  function write(patch: Partial<NonNullable<typeof stored>>) {
    if (!stored) return
    const { _id, _creationTime, groupId, updatedByUserId, ...rest } = stored
    save({ ...rest, ...patch, houseId, groupSlug })
  }

  function commit() {
    const value = Number(draft.trim().replace(',', '.'))
    if (!Number.isFinite(value) || value < 0) {
      setEditing(null)
      return
    }
    const cents = Math.round(value * 100)
    if (editing === 'price') write({ purchasePriceCents: cents })
    if (editing === 'ownMoney') write({ ownMoneyCents: cents })
    if (editing === 'mortgage') write({ mortgageCents: cents })
    if (editing === 'rate') write({ mortgageRatePercent: value })
    if (editing === 'nhg') write({ nhgPercent: value })
    if (editing && (BUYING_COST_LINES as readonly string[]).includes(editing))
      write({ lines: { ...stored?.lines, [editing]: cents } })
    setDraft('')
    setEditing(null)
  }

  const short = result.shortCents

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: text.buyingCosts.title }}
      />
      <ScreenScroll bottomInset={90}>
        <Section title={text.buyingCosts.purchase} />
        <Card>
          <Row
            label={text.buyingCosts.price}
            value={format.money(stored.purchasePriceCents, { decimals: false })}
            emphasis
            chevron
            onPress={() => {
              setDraft(String(stored.purchasePriceCents / 100))
              setEditing('price')
            }}
          />
          <Row
            label={text.buyingCosts.ownMoney}
            value={format.money(stored.ownMoneyCents, { decimals: false })}
            emphasis
            chevron
            onPress={() => {
              setDraft(String(stored.ownMoneyCents / 100))
              setEditing('ownMoney')
            }}
          />
          <Row
            label={text.buyingCosts.mortgage}
            value={format.money(stored.mortgageCents, { decimals: false })}
            emphasis
            chevron
            onPress={() => {
              setDraft(String(stored.mortgageCents / 100))
              setEditing('mortgage')
            }}
          />
          <Row
            label={text.buyingCosts.rateAndTerm}
            value={`${format.percent(stored.mortgageRatePercent)} · ${termWords(
              stored.mortgageTermMonths,
              text.loanPart,
            )}`}
            chevron
            last
            onPress={() => {
              setDraft(String(stored.mortgageRatePercent))
              setEditing('rate')
            }}
          />
        </Card>

        <Section title={text.buyingCosts.transferTax} />
        <View style={styles.chips}>
          {TRANSFER_TAX_BANDS.map((band) => (
            <Chip
              key={band}
              label={`${text.transferTaxBands[band]} · ${format.percent(
                BAND_PERCENT[band],
                BAND_PERCENT[band] % 1 === 0 ? 0 : 1,
              )}`}
              selected={stored.transferTaxBand === band}
              onPress={() =>
                write({
                  transferTaxBand: band,
                  transferTaxPercent: BAND_PERCENT[band],
                })
              }
            />
          ))}
        </View>

        <Section title={text.buyingCosts.yourCosts} />
        <Card>
          <Row
            label={text.buyingCosts.transferTaxLine}
            value={format.money(result.transferTaxCents, { decimals: false })}
            emphasis
          />
          {BUYING_COST_LINES.map((line) => (
            <Row
              key={line}
              label={text.buyingCostLines[line]}
              value={format.money(stored.lines?.[line] ?? 0, {
                decimals: false,
              })}
              emphasis={(stored.lines?.[line] ?? 0) > 0}
              chevron
              onPress={() => {
                setDraft(String((stored.lines?.[line] ?? 0) / 100))
                setEditing(line)
              }}
            />
          ))}
          <Row
            label={text.buyingCosts.nhg}
            sub={stored.nhgPercent ? undefined : text.buyingCosts.nhgOff}
            value={
              stored.nhgPercent
                ? format.money(result.nhgCents, { decimals: false })
                : '—'
            }
            emphasis={Boolean(stored.nhgPercent)}
            chevron
            last
            onPress={() => {
              setDraft(String(stored.nhgPercent ?? 0.4))
              setEditing('nhg')
            }}
          />
        </Card>

        <View style={{ marginTop: 12 }}>
          <Card padded>
            <Figure
              caption={
                short > 0 ? text.buyingCosts.shortBy : text.buyingCosts.spareBy
              }
              amount={format.money(Math.abs(short), { decimals: false })}
              large
            />
            <Notice>
              {fmt(text.buyingCosts.shortBody, {
                own: format.money(stored.ownMoneyCents, { decimals: false }),
                needed: format.money(result.cashNeededCents, {
                  decimals: false,
                }),
              })}
            </Notice>
          </Card>
        </View>

        <Notice>{text.buyingCosts.notice}</Notice>
        <Disclaimer />
      </ScreenScroll>

      <AnswerBar
        amount={format.money(result.cashNeededCents, { decimals: false })}
        unit={text.buyingCosts.barCash}
        sub={fmt(text.buyingCosts.barMonthly, {
          amount: format.money(result.estimatedMonthlyCents, {
            decimals: false,
          }),
          term: termWords(stored.mortgageTermMonths, text.loanPart),
        })}
      />

      {editing ? (
        <NativeSheet
          title={sheetTitle(editing, text)}
          onClose={() => setEditing(null)}
          footer={<PrimaryButton label={text.actions.save} onPress={commit} />}
        >
          <Field
            label={sheetTitle(editing, text)}
            value={draft}
            onChangeText={setDraft}
            keyboardType="decimal-pad"
            suffix={editing === 'rate' || editing === 'nhg' ? '%' : undefined}
            autoFocus
          />
        </NativeSheet>
      ) : null}
    </>
  )
}

function sheetTitle(
  editing: NonNullable<Editing>,
  text: ReturnType<typeof useFinances>['text'],
): string {
  if (editing === 'price') return text.buyingCosts.price
  if (editing === 'ownMoney') return text.buyingCosts.ownMoney
  if (editing === 'mortgage') return text.buyingCosts.mortgage
  if (editing === 'rate') return text.buyingCosts.rateAndTerm
  if (editing === 'nhg') return text.buyingCosts.nhg
  return text.buyingCostLines[editing]
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
})
