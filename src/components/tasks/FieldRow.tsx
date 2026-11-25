/**
 * The rows of a task's Details (APP-308): an icon, a label and its value. A
 * row that can be changed opens its choices in a popover from `lg`, and in a
 * bottom sheet below it.
 */
import { ChevronRight, type LucideIcon } from 'lucide-react'
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { fmt, useMessages } from '../../lib/i18n'
import { Dialog } from '../app/Dialog'
import { useIsDesktop } from '../app/useMediaQuery'
import { useModalFocus } from '../app/useModalFocus'

const ROW =
  'flex min-h-[46px] w-full items-center gap-2.5 px-3.5 py-2 text-left text-body text-[var(--ink)]'

export function FieldGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <ul
      aria-label={label}
      className="m-0 list-none overflow-hidden rounded-2xl bg-[var(--ground)] p-0"
    >
      {children}
    </ul>
  )
}

function Cells({
  icon: Glyph,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  tone?: 'danger' | 'muted'
}) {
  return (
    <>
      <Glyph
        className="size-[18px] shrink-0 text-[var(--muted)]"
        aria-hidden="true"
      />
      <span className="shrink-0">{label}</span>
      <span
        className={`ml-auto min-w-0 text-right break-words ${
          tone === 'danger'
            ? 'font-semibold text-[var(--danger)]'
            : 'text-[var(--muted)]'
        }`}
      >
        {value}
      </span>
    </>
  )
}

interface FieldRowProps {
  icon: LucideIcon
  label: string
  /** What it is set to, in words. */
  value: string
  tone?: 'danger' | 'muted'
  /** Its choices; without any the row only says its value. */
  editor?: (close: () => void) => ReactNode
}

export function FieldRow({ icon, label, value, tone, editor }: FieldRowProps) {
  const words = useMessages().tasks.web.panel
  const desktop = useIsDesktop()
  const button = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <li className="[&+&]:border-t-[0.5px] [&+&]:border-[var(--hair)]">
      {editor ? (
        <button
          ref={button}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={fmt(words.fieldValue, { label, value })}
          onClick={() => setOpen(!open)}
          className={`${ROW} cursor-pointer border-0 bg-transparent font-[inherit] hover:bg-[var(--surface-2)]`}
        >
          <Cells icon={icon} label={label} value={value} tone={tone} />
          <ChevronRight
            className="size-4 shrink-0 text-[var(--muted)]"
            aria-hidden="true"
          />
        </button>
      ) : (
        <div className={ROW}>
          <Cells icon={icon} label={label} value={value} tone={tone} />
        </div>
      )}
      {open && editor ? (
        desktop ? (
          <Popover title={label} anchor={button} onClose={close}>
            {editor(close)}
          </Popover>
        ) : (
          <Dialog title={label} onClose={close}>
            {editor(close)}
          </Dialog>
        )
      ) : null}
    </li>
  )
}

const MARGIN = 12
const WIDTH = 340

/** A dialog under its row, kept on screen; above it when there is no room. */
function Popover({
  title,
  anchor,
  onClose,
  children,
}: {
  title: string
  anchor: RefObject<HTMLButtonElement | null>
  onClose: () => void
  children: ReactNode
}) {
  const modal = useModalFocus<HTMLDivElement>({ onClose })
  const { ref } = modal
  const [place, setPlace] = useState({ top: MARGIN, left: MARGIN })

  useLayoutEffect(() => {
    const move = () => {
      const row = anchor.current?.getBoundingClientRect()
      const box = ref.current
      if (!row || !box) return
      const below = row.bottom + 6
      const height = box.offsetHeight
      const top =
        below + height <= window.innerHeight - MARGIN
          ? below
          : row.top - 6 - height
      setPlace({
        top: Math.max(
          MARGIN,
          Math.min(top, window.innerHeight - MARGIN - height),
        ),
        left: Math.max(
          MARGIN,
          Math.min(row.right, window.innerWidth - MARGIN) - WIDTH,
        ),
      })
    }
    move()
    const watch =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(move)
    if (ref.current) watch?.observe(ref.current)
    window.addEventListener('resize', move)
    window.addEventListener('scroll', move, true)
    return () => {
      watch?.disconnect()
      window.removeEventListener('resize', move)
      window.removeEventListener('scroll', move, true)
    }
  }, [anchor, ref])

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element
      if (ref.current?.contains(target) || anchor.current?.contains(target))
        return
      // A confirmation asked from inside it is not outside it.
      if (target.closest('[aria-modal="true"]')) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  })

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-group="home"
      onKeyDown={modal.onKeyDown}
      style={{ top: place.top, left: place.left, width: WIDTH }}
      className="fixed z-40 grid max-h-[calc(100dvh-24px)] max-w-[calc(100vw-24px)] gap-3 overflow-y-auto rounded-[var(--radius-card)] border-[0.5px] border-[var(--hair-strong)] bg-[var(--surface)] p-3.5 text-[var(--ink)] shadow-lg"
    >
      <h3 className="m-0 px-1 text-subhead font-semibold">{title}</h3>
      {children}
    </div>,
    document.body,
  )
}
