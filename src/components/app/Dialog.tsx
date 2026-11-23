import { X } from 'lucide-react'
import { type ReactNode, type RefObject, useId } from 'react'
import { useMessages } from '../../lib/i18n'
import { useIsDesktop } from './useMediaQuery'
import { useModalFocus } from './useModalFocus'

/**
 * The web's one modal surface: a centred 480 px card on a scrim at and above
 * `lg`, the same content as a bottom sheet below it (top corners 22 px, a
 * grabber), as the phone presents it.
 *
 * Page and sheet are presentations, not separate screens (editors standard):
 * the content and its draft are the caller's, so crossing the breakpoint while
 * it is open keeps whatever was typed. Focus handling is `useModalFocus`'s:
 * focus moves in, Tab stays in, Escape closes only the top modal, focus goes
 * back to the opener.
 */
export interface DialogProps {
  /** The heading, and the dialog's accessible name. */
  title: string
  onClose: () => void
  children: ReactNode
  /** The row of buttons at the bottom: Cancel, then the primary. */
  actions?: ReactNode
  /** What takes focus first; the first control by default. */
  initialFocus?: RefObject<HTMLElement | null> | false
  /** Draws the round close button beside the title. Default true. */
  closeButton?: boolean
  /** `alertdialog` for a question that must be answered (a confirmation). */
  role?: 'dialog' | 'alertdialog'
}

export function Dialog({
  title,
  onClose,
  children,
  actions,
  initialFocus,
  closeButton = true,
  role = 'dialog',
}: DialogProps) {
  const desktop = useIsDesktop()
  const titleId = useId()
  const close = useMessages().common.actions.close
  const modal = useModalFocus<HTMLDivElement>({ onClose, initialFocus })

  return (
    // The scrim is a pointer convenience; Escape and the close button are the
    // keyboard's way out, so it carries no role of its own.
    // biome-ignore lint/a11y/noStaticElementInteractions: see above
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled by useModalFocus
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-black/40 ${
        desktop ? 'items-center p-4' : 'items-end'
      }`}
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the scrim's click */}
      <div
        ref={modal.ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        data-presentation={desktop ? 'dialog' : 'sheet'}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={modal.onKeyDown}
        className={`grid max-h-[90svh] gap-3.5 overflow-y-auto bg-[var(--surface)] text-[var(--ink)] ${
          desktop
            ? 'w-[min(480px,100%)] rounded-[var(--radius-card)] p-5'
            : 'w-full rounded-t-[var(--radius-card)] px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]'
        }`}
      >
        {desktop ? null : (
          <span
            aria-hidden="true"
            data-grabber=""
            className="mx-auto h-[5px] w-9 rounded-[var(--radius-pill)] bg-[var(--hair-strong)]"
          />
        )}
        <div className="flex items-center gap-2.5">
          <h2
            id={titleId}
            className="m-0 min-w-0 flex-1 font-rounded text-title-2 font-bold"
          >
            {title}
          </h2>
          {closeButton ? (
            <button
              type="button"
              aria-label={close}
              onClick={onClose}
              className="grid size-8 pointer-coarse:size-[var(--size-control-min)] shrink-0 place-items-center rounded-[var(--radius-pill)] bg-[var(--surface-2)] text-[var(--ink)]"
            >
              <X className="size-3.5" strokeWidth={2.6} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {children}
        {actions ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  )
}
