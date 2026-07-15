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

export interface StatusDotProps {
  label: string
  tone?: 'success' | 'warning' | 'muted'
}

export function StatusDot({ label, tone = 'success' }: StatusDotProps) {
  return (
    <span className="shell-status">
      <span className={`shell-status-dot shell-status-dot-${tone}`} />
      {label}
    </span>
  )
}

export interface AvatarStackProps {
  members: string[]
  max?: number
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase()
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase()
}

export function AvatarStack({ members, max = 4 }: AvatarStackProps) {
  const visible = members.slice(0, max)
  const remaining = members.length - visible.length

  return (
    <fieldset
      className="shell-avatar-stack"
      aria-label={`${members.length} members`}
    >
      {visible.map((member) => (
        <span key={member} className="shell-avatar" title={member}>
          {initials(member)}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="shell-avatar shell-avatar-more">+{remaining}</span>
      ) : null}
    </fieldset>
  )
}
