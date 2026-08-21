/**
 * The rows an entry is made of: chips where there is a closed set, a stepper
 * where there is a number, a text box where there is neither.
 *
 * Lifted out of `QuickLogSheet` when the entry screen gained an edit mode.
 * There are now two places a person fills these in — creating an entry and
 * correcting one — and they have to be the same rows, in the same order, with
 * the same words on them. Two copies would have drifted the first time a field
 * was added to one and not the other, and the drift would show up as an entry
 * you can create but not edit.
 *
 * Which rows exist is `fieldsFor`'s answer, not this component's: the shape of
 * a feed depends on whether it was breast, bottle or solid, and that logic is
 * pure and tested next to the rest of it in `sheetFields.ts`.
 */
import type { BabyEventType } from '@gather/core/domain'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { fmt, useI18n } from '../../i18n'
import { RADIUS, useTokens } from '../../theme/tokens'
import { NumberField } from './NumberField'
import { fieldsFor, type SheetField } from './sheetFields'

/** The visible name of a row, from the shared `baby.log.fields` tree. */
export function fieldLabel(
  labels: Record<string, string>,
  field: { labelKey: string },
): string {
  return labels[field.labelKey] ?? field.labelKey
}

export interface OptionLabels {
  temperatureMethod: Record<string, string>
  feedingMethod: Record<string, string>
  diaperKind: Record<string, string>
}

/**
 * The word for one stored option.
 *
 * `method` names two different closed sets depending on whose row it is — a
 * temperature is oral or rectal, a feed is breast or bottle — so the type has
 * to be part of the lookup. Anything with no translated set is content and is
 * shown exactly as stored (ADR-0011).
 *
 * Exported because the entry screen reads entries back as well as writing
 * them, and a value that is called "Bottle" in the form must not be called
 * "bottle" when you look at it afterwards.
 */
export function optionText(
  type: BabyEventType,
  fieldKey: string,
  value: string,
  options: OptionLabels,
): string {
  if (fieldKey === 'method' && type === 'temperature') {
    return options.temperatureMethod[value] ?? value
  }
  if (fieldKey === 'method' && type === 'feeding') {
    return options.feedingMethod[value] ?? value
  }
  if (fieldKey === 'kind') return options.diaperKind[value] ?? value
  return value
}

export interface EntryFieldsProps {
  type: BabyEventType
  picks: Record<string, string>
  onChange: (key: string, value: string) => void
}

export function EntryFields({ type, picks, onChange }: EntryFieldsProps) {
  const tokens = useTokens('home')
  const { t } = useI18n()
  const tint = tokens.tintOf('home')

  const labels = t.baby.log.fields as Record<string, string>
  const options = t.baby.log.options

  function row(field: SheetField) {
    const value = picks[field.key] ?? ''
    const name = fieldLabel(labels, field)

    return (
      <View key={field.key} style={styles.field}>
        <Text style={[styles.fieldLabel, { color: tokens.muted }]}>
          {name.toUpperCase()}
        </Text>

        {field.input === 'number' ? (
          <NumberField
            field={field}
            value={value}
            onChange={(next) => onChange(field.key, next)}
            label={name}
            decreaseLabel={fmt(t.baby.log.entry.less, { field: name })}
            increaseLabel={fmt(t.baby.log.entry.more, { field: name })}
          />
        ) : field.input === 'text' ? (
          <TextInput
            value={value}
            onChangeText={(next) => onChange(field.key, next)}
            accessibilityLabel={name}
            style={[
              styles.textField,
              {
                borderColor: tokens.border,
                backgroundColor: tokens.bg,
                color: tokens.fg,
              },
            ]}
          />
        ) : (
          <View style={styles.chips}>
            {field.options.map((option) => {
              const on = value === option
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => onChange(field.key, option)}
                  style={[
                    styles.chip,
                    {
                      borderColor: on ? tokens.accent : tokens.border,
                      backgroundColor: on ? tint.bg : tokens.bg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: on ? tokens.accent : tokens.fg,
                        fontWeight: on ? '700' : '500',
                      },
                    ]}
                  >
                    {optionText(type, field.key, option, options)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}
      </View>
    )
  }

  return <>{fieldsFor(type, picks).map(row)}</>
}

const styles = StyleSheet.create({
  field: { gap: 7 },
  fieldLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: RADIUS.control,
  },
  chipText: { fontSize: 15 },
  textField: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.control,
    paddingHorizontal: 14,
    fontSize: 16,
  },
})
