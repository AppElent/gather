import { Link } from '@tanstack/react-router'
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import type { AppLink } from '../../lib/links'

/**
 * A menu button, small and local to the shell: the account menu and Add.
 *
 * The WAI-ARIA menu button pattern, no more. Enter, Space or ArrowDown on the
 * button open it on the first item and ArrowUp on the last; ArrowUp/ArrowDown,
 * Home and End move between items; Escape closes it and puts focus back on the
 * button; Tab and a click elsewhere close it. Choosing an item closes it with
 * focus back on the button first, so a dialog the item opens returns there.
 *
 * Row menus in Module pages are APP-639's `RowMenu`, not this.
 */

const CloseMenu = createContext<() => void>(() => {})

export interface ShellMenuProps {
  /** The button's accessible name, and the menu's. */
  label: string
  /** What the button draws. */
  trigger: ReactNode
  triggerClassName: string
  /** Where the menu sits relative to the button (position classes). */
  menuClassName: string
  children: ReactNode
  /** Leave the button's name to its content when that already says it. */
  labelFromContent?: boolean
}

const MENU =
  'absolute z-40 grid gap-0.5 rounded-[var(--radius-card)] border border-[var(--hair)] bg-[var(--surface)] p-1.5 text-[var(--ink)] shadow-lg'

export function ShellMenu({
  label,
  trigger,
  triggerClassName,
  menuClassName,
  children,
  labelFromContent = false,
}: ShellMenuProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const focusOnOpen = useRef<'first' | 'last'>('first')
  const id = useId()

  const items = () =>
    Array.from(
      menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    )

  useEffect(() => {
    if (!open) return
    const list = items()
    ;(focusOnOpen.current === 'last' ? list.at(-1) : list[0])?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }

  function openOn(where: 'first' | 'last') {
    focusOnOpen.current = where
    setOpen(true)
  }

  function onButtonKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openOn(event.key === 'ArrowUp' ? 'last' : 'first')
    }
  }

  function onMenuKeyDown(event: KeyboardEvent) {
    const list = items()
    if (list.length === 0) return
    const at = list.indexOf(document.activeElement as HTMLElement)
    const move = (to: number) => {
      event.preventDefault()
      list[(to + list.length) % list.length]?.focus()
    }
    switch (event.key) {
      case 'ArrowDown':
        return move(at + 1)
      case 'ArrowUp':
        return move(at - 1)
      case 'Home':
        return move(0)
      case 'End':
        return move(list.length - 1)
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        return close()
      case 'Tab':
        return setOpen(false)
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={labelFromContent ? undefined : label}
        onClick={() => (open ? setOpen(false) : openOn('first'))}
        onKeyDown={onButtonKeyDown}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={`${MENU} ${menuClassName}`}
        >
          <CloseMenu value={close}>{children}</CloseMenu>
        </div>
      ) : null}
    </div>
  )
}

const ITEM =
  'flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-control)] px-2.5 text-left text-[15px] text-[var(--ink)] no-underline hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)]'

export function MenuLink({
  link,
  children,
}: {
  link: AppLink
  children: ReactNode
}) {
  const close = useContext(CloseMenu)
  return (
    <Link
      {...link}
      role="menuitem"
      tabIndex={-1}
      onClick={close}
      className={ITEM}
    >
      {children}
    </Link>
  )
}

export function MenuButton({
  onSelect,
  children,
}: {
  onSelect: () => void
  children: ReactNode
}) {
  const close = useContext(CloseMenu)
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={() => {
        close()
        onSelect()
      }}
      className={ITEM}
    >
      {children}
    </button>
  )
}

/** A line between groups of items. */
export function MenuSeparator() {
  return <hr className="mx-2.5 my-1 h-px border-0 bg-[var(--hair)]" />
}
