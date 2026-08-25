/**
 * Adding a recurring cost, in one sheet.
 *
 * A hook rather than a component because two screens open the same sheet — the
 * list and the empty state on it — and the alternative was passing four pieces
 * of state down through both.
 *
 * The category picker is chips rather than a second sheet: the set is closed,
 * seven long, and typed against `CostCategory`, so it fits and forgetting one
 * is a compile error rather than a missing option.
 */

import {
  COST_CATEGORIES,
  COST_FREQUENCIES,
  type CostCategory,
  type CostFrequency,
} from '@gather/core/finance'
import { useMutation } from 'convex/react'
import { type ReactNode, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { api } from '../../../../../convex/_generated/api'
import { NativeSheet } from '../../components/NativeSheet'
import { useI18n } from '../../i18n'
import { Chip, Field, PrimaryButton } from './ui'

export function useCostSheet(groupSlug: string): {
  open: () => void
  element: ReactNode
} {
  const { t } = useI18n()
  const text = t.finances
  const create = useMutation(api.recurringCosts.create)

  const [showing, setShowing] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState<CostFrequency>('monthly')
  const [category, setCategory] = useState<CostCategory>('housing')

  function open() {
    setName('')
    setAmount('')
    setFrequency('monthly')
    setCategory('housing')
    setShowing(true)
  }

  function save() {
    const cents = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!name.trim() || !Number.isFinite(cents) || cents <= 0) return
    create({
      groupSlug,
      name: name.trim(),
      amountCents: cents,
      frequency,
      category,
    })
    setShowing(false)
  }

  const valid =
    name.trim().length > 0 &&
    Number.isFinite(Number(amount.replace(',', '.'))) &&
    Number(amount.replace(',', '.')) > 0

  return {
    open,
    element: showing ? (
      <NativeSheet
        title={text.recurringCosts.addCost}
        onClose={() => setShowing(false)}
        footer={
          <PrimaryButton
            label={text.actions.save}
            onPress={save}
            disabled={!valid}
          />
        }
      >
        <Field
          label={text.recurringCosts.cost.theCost}
          value={name}
          onChangeText={setName}
          placeholder={text.recurringCosts.cost.namePlaceholder}
          autoFocus
        />
        <Field
          label={text.recurringCosts.cost.amount}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <View style={styles.chips}>
          {COST_FREQUENCIES.map((option) => (
            <Chip
              key={option}
              label={text.frequencies[option]}
              selected={frequency === option}
              onPress={() => setFrequency(option)}
            />
          ))}
        </View>
        <View style={styles.chips}>
          {COST_CATEGORIES.map((option) => (
            <Chip
              key={option}
              label={text.categories[option]}
              selected={category === option}
              onPress={() => setCategory(option)}
            />
          ))}
        </View>
      </NativeSheet>
    ) : null,
  }
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 6 },
})
