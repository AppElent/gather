import type { ReactNode } from 'react'

/** The rows of a single choice: the current one is marked. */
export function ChoiceList<T extends string | number | null>({
  label,
  options,
  current,
  onChoose,
}: {
  label: string
  options: readonly { id: T; label: ReactNode; disabled?: boolean }[]
  /** Absent when none of the options is. */
  current: T | undefined
  onChoose: (id: T) => void
}) {
  return (
    <ul
      aria-label={label}
      className="m-0 list-none overflow-hidden rounded-[var(--radius-control)] bg-[var(--ground)] p-0"
    >
      {options.map((option) => (
        <li
          key={String(option.id)}
          className="[&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]"
        >
          <button
            type="button"
            aria-pressed={option.id === current}
            disabled={option.disabled}
            onClick={() => onChoose(option.id)}
            className={`flex min-h-[var(--size-control-min)] w-full cursor-pointer items-center gap-2 border-0 px-3.5 py-2 text-left font-[inherit] text-body text-[var(--ink)] enabled:hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-45 ${
              option.id === current
                ? 'bg-[var(--surface-2)] font-semibold'
                : 'bg-transparent'
            }`}
          >
            {option.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
