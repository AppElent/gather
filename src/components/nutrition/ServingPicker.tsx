import type { AmountChoice, OfferedServing } from '../../../convex/lib/servings'
import { parseServingAmount } from '../../../convex/lib/servings'
import { useMessages } from '../../lib/i18n'

/** What the card has selected, before it is turned into an amount. */
export type ServingSelection =
  | { kind: 'serving'; index: number }
  | { kind: 'custom'; input: string; unit: 'base' | 'serving' }

/** The amount somebody typing "Custom" starts from when a food has no servings. */
const DEFAULT_CUSTOM_INPUT = '100'

/**
 * What a card opens on: the food's first serving if it has one, and a plain
 * amount otherwise. Never nothing — an expanded card always shows what it
 * would log.
 */
export function initialSelection(
  offered: readonly OfferedServing[],
): ServingSelection {
  return offered.length > 0
    ? { kind: 'serving', index: 0 }
    : { kind: 'custom', input: DEFAULT_CUSTOM_INPUT, unit: 'base' }
}

/**
 * What a picker opens on when the amount is already known — editing an entry
 * rather than logging a new one (#102).
 *
 * The chip that *means* this amount if there is one, so a "1 slice" entry
 * opens on "1 slice" rather than on an anonymous 35 that would quietly become
 * a custom amount the moment anything else was touched. Anything else opens as
 * the custom amount it is, which is also the whole answer for a food with no
 * servings at all — unlike `initialSelection`, there is an amount to start
 * from here, so nothing has to be defaulted.
 */
export function selectionForAmount(
  offered: readonly OfferedServing[],
  amount: number,
): ServingSelection {
  const index = offered.findIndex((serving) => serving.amount === amount)
  return index >= 0
    ? { kind: 'serving', index }
    : { kind: 'custom', input: String(amount), unit: 'base' }
}

/**
 * Turn a selection into the choice `resolveAmount` understands, or
 * `undefined` when there is nothing coherent to log yet — an empty custom
 * field, a chip that is no longer there.
 *
 * A custom amount counted in servings needs a serving to count: the selected
 * one if a chip is selected, else the food's first. With no servings at all
 * the unit toggle is not offered, so this falls back to the base unit rather
 * than inventing a portion.
 */
export function toChoice(
  offered: readonly OfferedServing[],
  selection: ServingSelection,
): AmountChoice | undefined {
  if (selection.kind === 'serving') {
    const serving = offered[selection.index]
    return serving ? { kind: 'serving', serving } : undefined
  }
  const value = parseServingAmount(selection.input)
  if (value === undefined) return undefined
  const serving = offered[0]
  if (selection.unit === 'serving' && serving) {
    return { kind: 'custom', value, unit: 'serving', serving }
  }
  return { kind: 'custom', value, unit: 'base' }
}

interface Props {
  baseUnit: 'g' | 'ml'
  offered: readonly OfferedServing[]
  selection: ServingSelection
  onSelect: (selection: ServingSelection) => void
  /**
   * Locked while a save is in flight. The handler has already captured the
   * amount it is writing, so a chip tapped now would change what is on screen
   * without changing what is being saved — and the editor closes over it.
   */
  disabled?: boolean
}

/**
 * How much of this, chosen rather than calculated.
 *
 * The named servings a food carries, then the amounts you have logged for it
 * yourself, and always a Custom at the end so the chips can never trap you.
 * Chips are thumb-sized and the field is 16px, because a mobile browser zooms
 * the page on focusing anything smaller and never zooms back.
 */
export function ServingPicker({
  baseUnit,
  offered,
  selection,
  onSelect,
  disabled = false,
}: Props) {
  const { add } = useMessages().nutrition.diary
  const custom = selection.kind === 'custom'
  const unitServing = offered[0]

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {offered.map((serving, index) => {
          const selected =
            selection.kind === 'serving' && selection.index === index
          return (
            <button
              key={`${serving.label}-${serving.amount}`}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onSelect({ kind: 'serving', index })}
              className={`min-h-11 rounded-full border px-3 text-sm disabled:opacity-60 ${
                selected
                  ? 'border-[var(--app-fg)] bg-[var(--app-fg)] text-[var(--app-surface)]'
                  : 'border-[var(--app-border)]'
              }`}
            >
              {serving.label}
              {/* Yours rather than the food's — an amount you have logged
                  before, offered back to you (#68). The space is written out
                  so the chip's accessible name has one too. */}
              {serving.own && (
                <>
                  {' '}
                  <span className="opacity-60">{add.yourAmount}</span>
                </>
              )}
            </button>
          )
        })}
        <button
          type="button"
          aria-pressed={custom}
          disabled={disabled}
          onClick={() =>
            onSelect({
              kind: 'custom',
              input: custom ? selection.input : DEFAULT_CUSTOM_INPUT,
              unit: 'base',
            })
          }
          className={`min-h-11 rounded-full border px-3 text-sm disabled:opacity-60 ${
            custom
              ? 'border-[var(--app-fg)] bg-[var(--app-fg)] text-[var(--app-surface)]'
              : 'border-[var(--app-border)]'
          }`}
        >
          {add.custom}
        </button>
      </div>
      {custom && (
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            disabled={disabled}
            value={selection.input}
            onChange={(e) => onSelect({ ...selection, input: e.target.value })}
            aria-label={add.amount}
            className="min-h-11 w-24 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[16px]"
          />
          {unitServing ? (
            <select
              disabled={disabled}
              value={selection.unit}
              onChange={(e) =>
                onSelect({
                  ...selection,
                  unit: e.target.value as 'base' | 'serving',
                })
              }
              aria-label={add.unit}
              className="min-h-11 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[16px]"
            >
              <option value="base">{baseUnit}</option>
              <option value="serving">{unitServing.label}</option>
            </select>
          ) : (
            <span className="text-sm opacity-60">{baseUnit}</span>
          )}
        </div>
      )}
    </div>
  )
}
