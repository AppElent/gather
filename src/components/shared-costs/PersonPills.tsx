import type { Person } from './splitDraft'

/** People as neutral pills: one is picked as payer, several as participants. */
export function PersonPills({
  label,
  people,
  selected,
  onPress,
}: {
  label: string
  people: readonly Person[]
  selected: readonly string[]
  onPress: (id: string) => void
}) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">{label}</legend>
      {people.map((person) => {
        const on = selected.includes(person.id)
        return (
          <button
            key={person.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPress(person.id)}
            className={`min-h-9 pointer-coarse:min-h-[var(--size-control-min)] max-w-full truncate rounded-[var(--radius-pill)] px-3.5 text-subhead font-semibold ${
              on
                ? 'bg-[var(--ink)] text-[var(--on-ink)]'
                : 'bg-[var(--surface-2)] text-[var(--muted)]'
            }`}
          >
            {person.name}
          </button>
        )
      })}
    </fieldset>
  )
}
