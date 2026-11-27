import { Check } from 'lucide-react'

/**
 * A task's check ring, a checkbox in the group's text colour. Its target is
 * 44 px whatever it draws, and sits above the row's stretched link.
 */
export function CheckRing({
  label,
  checked,
  disabled = false,
  onToggle,
  size = 'm',
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onToggle: () => void
  size?: 's' | 'm' | 'l'
}) {
  const box = { s: 'size-[18px]', m: 'size-6', l: 'size-[26px]' }[size]
  const glyph = { s: 'size-2.5', m: 'size-3.5', l: 'size-4' }[size]
  return (
    <label
      className={`relative z-[1] -my-2 -mr-2.5 -ml-2.5 grid size-[var(--size-control-min)] shrink-0 place-items-center ${
        disabled ? 'cursor-default' : 'cursor-pointer'
      }`}
    >
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        // Space ticks it; Enter does too, as on a button.
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          onToggle()
        }}
        className="peer absolute inset-0 m-0 cursor-[inherit] opacity-0"
      />
      <span
        aria-hidden="true"
        className={`grid place-items-center rounded-[var(--radius-pill)] border-2 border-[var(--home-text)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ink)] peer-disabled:opacity-50 ${box} ${
          checked ? 'bg-[var(--home-text)] text-[var(--surface)]' : ''
        }`}
      >
        {checked ? <Check className={glyph} strokeWidth={3} /> : null}
      </span>
    </label>
  )
}
