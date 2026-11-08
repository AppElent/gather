import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string
  children: ReactNode
}

export function IconButton({
  label,
  children,
  className = '',
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`shell-icon-button ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
}

export interface SurfaceCardProps {
  children: ReactNode
  className?: string
  ariaLabel?: string
}

export function SurfaceCard({
  children,
  className = '',
  ariaLabel,
}: SurfaceCardProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={`shell-card ${className}`.trim()}
    >
      {children}
    </section>
  )
}

export interface PillProps {
  children: ReactNode
  tone?: 'default' | 'dark' | 'success' | 'warning'
  className?: string
}

export function Pill({
  children,
  tone = 'default',
  className = '',
}: PillProps) {
  return (
    <span className={`shell-pill shell-pill-${tone} ${className}`.trim()}>
      {children}
    </span>
  )
}

export interface SectionHeaderProps {
  title: string
  eyebrow?: string
  action?: ReactNode
}

export function SectionHeader({ title, eyebrow, action }: SectionHeaderProps) {
  return (
    <header className="shell-section-header">
      <div className="min-w-0">
        {eyebrow ? <p className="shell-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
