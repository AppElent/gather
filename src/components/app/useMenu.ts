import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react'

/**
 * A menu button whose items are the caller's own (RowMenu draws a fixed kind).
 * The WAI-ARIA pattern: it opens on the chosen item, else the first; ArrowUp
 * on the button opens it on the last; arrows, Home and End move; Escape closes
 * it and returns to the button; Tab or a press elsewhere closes it.
 *
 * Spread `button` on the button and `menu` on the `role="menu"` element.
 */
export function useMenu() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const startAtEnd = useRef(false)
  const menuId = useId()

  const items = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ??
        [],
    )

  // biome-ignore lint/correctness/useExhaustiveDependencies: `items` reads the menu on screen, focus is placed once per opening
  useEffect(() => {
    if (!open) return
    const list = items()
    const chosen = list.find(
      (item) => item.getAttribute('aria-checked') === 'true',
    )
    ;(startAtEnd.current ? list.at(-1) : (chosen ?? list[0]))?.focus()
    startAtEnd.current = false
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

  /** Closes the menu, back to its button unless the choice moves focus. */
  const close = (returnFocus = true) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  const onMenuKey = (event: KeyboardEvent) => {
    const list = items()
    const at = list.indexOf(document.activeElement as HTMLElement)
    const move = (index: number) => {
      event.preventDefault()
      list.at(index % list.length)?.focus()
    }
    if (event.key === 'ArrowDown') move(at + 1)
    else if (event.key === 'ArrowUp') move(at <= 0 ? list.length - 1 : at - 1)
    else if (event.key === 'Home') move(0)
    else if (event.key === 'End') move(list.length - 1)
    else if (event.key === 'Tab') close(false)
    else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }

  return {
    open,
    close,
    button: {
      ref: buttonRef,
      type: 'button',
      'aria-haspopup': 'menu',
      'aria-expanded': open,
      'aria-controls': open ? menuId : undefined,
      onClick: () => setOpen((current) => !current),
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        startAtEnd.current = event.key === 'ArrowUp'
        setOpen(true)
      },
    },
    menu: {
      ref: menuRef,
      id: menuId,
      role: 'menu',
      tabIndex: -1,
      onKeyDown: onMenuKey,
    },
  } as const
}
