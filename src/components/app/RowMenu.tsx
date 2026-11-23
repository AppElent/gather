import { MoreHorizontal } from 'lucide-react'
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { fmt, useMessages } from '../../lib/i18n'

/**
 * A row's actions behind one `⋯` button (web-shell_final.md, "Lists"),
 * replacing the always-visible up/down, edit and delete icons.
 *
 * The button shows while the row is hovered or holds keyboard focus, and
 * always on a touch screen, which has no hover to reveal it. Its menu follows
 * the WAI-ARIA menu button pattern: Enter, Space or ArrowDown open it on the
 * first item, ArrowUp on the last; arrows, Home and End move; Escape closes it
 * and returns to the button; Tab closes it and moves on.
 */
export interface RowMenuAction {
  id: string
  label: string
  onSelect: () => void
  /** Drawn in `danger`: a destructive action. */
  danger?: boolean
  icon?: ReactNode
}

export function RowMenu({
  item,
  actions,
  alwaysVisible = false,
}: {
  /** What the row is, for "Actions for {item}". */
  item: string
  actions: readonly RowMenuAction[]
  /** Shows the button without hover, where the row has no other target. */
  alwaysVisible?: boolean
}) {
  const label = fmt(useMessages().common.rowActions, { item })
  const [open, setOpen] = useState(false)
  const [above, setAbove] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  // Which item to focus once the menu is on screen: 0 first, -1 last.
  const pendingFocus = useRef<number | null>(null)

  const items = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
        [],
    )

  useEffect(() => {
    if (!open) return
    const index = pendingFocus.current
    pendingFocus.current = null
    if (index !== null) items().at(index)?.focus()
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        !menuRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      )
        setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const show = (focus: number) => {
    const rect = buttonRef.current?.getBoundingClientRect()
    // Open upwards when a menu of this length would run off the bottom.
    setAbove(
      Boolean(rect && rect.bottom + 48 * actions.length + 16 > window.innerHeight),
    )
    pendingFocus.current = focus
    setOpen(true)
  }

  const close = (returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  const onButtonKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      show(event.key === 'ArrowDown' ? 0 : -1)
    }
  }

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = items()
    const at = list.indexOf(document.activeElement as HTMLElement)
    const move = (index: number) => {
      event.preventDefault()
      list.at(index % list.length)?.focus()
    }
    switch (event.key) {
      case 'ArrowDown':
        return move(at + 1)
      case 'ArrowUp':
        return move(at <= 0 ? list.length - 1 : at - 1)
      case 'Home':
        return move(0)
      case 'End':
        return move(list.length - 1)
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        return close(true)
      case 'Tab':
        return close(false)
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-row-menu=""
        onClick={() => (open ? close(false) : show(0))}
        onKeyDown={onButtonKey}
        className={`grid size-9 pointer-coarse:size-[var(--size-control-min)] place-items-center rounded-[var(--radius-pill)] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)] focus-visible:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100 ${
          open || alwaysVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onMenuKey}
          className={`absolute right-0 z-20 grid min-w-48 rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] p-1 shadow-lg ${
            above ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                close(true)
                action.onSelect()
              }}
              className={`flex min-h-11 items-center gap-2.5 rounded-[8px] px-3 text-left text-body whitespace-nowrap hover:bg-[var(--surface-2)] focus:bg-[var(--surface-2)] focus:outline-none ${
                action.danger ? 'text-[var(--danger)]' : 'text-[var(--ink)]'
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  )
}
