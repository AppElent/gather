import { useMessages } from '../i18n'
import { cn } from './utils'

export function AuthButton({
  children,
  loading,
  disabled,
  variant = 'primary',
  type = 'submit',
  onClick,
  className,
}: {
  children: React.ReactNode
  loading?: boolean
  /** Inert without the busy label, e.g. while another button's action runs. */
  disabled?: boolean
  variant?: 'primary' | 'ghost'
  type?: 'submit' | 'button'
  onClick?: () => void
  className?: string
}) {
  const { auth } = useMessages()
  return (
    <button
      type={type}
      disabled={loading || disabled}
      aria-busy={loading ?? false}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--auth-radius)] px-4 py-2 text-sm font-medium transition disabled:opacity-60',
        variant === 'primary'
          ? 'bg-[var(--auth-accent)] text-[var(--auth-accent-fg)] hover:opacity-90'
          : 'border border-dashed border-[var(--auth-accent)] text-[var(--auth-fg)] hover:bg-[var(--auth-border)]',
        className,
      )}
    >
      {loading ? auth.wait : children}
    </button>
  )
}
