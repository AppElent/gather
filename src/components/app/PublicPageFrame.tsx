import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useMessages } from '../../lib/i18n'

interface PublicPageFrameProps {
  eyebrow: string
  title: string
  subtitle: string
  children: ReactNode
  actions?: ReactNode
  /** Room for long-form reading, such as the privacy statement. */
  wide?: boolean
}

export function PublicPageFrame({
  eyebrow,
  title,
  subtitle,
  children,
  actions,
  wide = false,
}: PublicPageFrameProps) {
  const messages = useMessages()
  const { publicFrame } = messages.shell

  return (
    <main className="app-shell grid min-h-svh grid-rows-[auto_1fr] bg-[var(--ground)] text-[var(--ink)]">
      <header className="border-b border-[var(--hair)] bg-[color-mix(in_oklch,var(--surface)_88%,transparent)]">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 text-[var(--ink)] no-underline"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[var(--radius-control)] border border-[var(--hair)] bg-[var(--surface)] text-sm font-bold">
              G
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-sm">
                {publicFrame.brand}
              </strong>
              <span className="block truncate text-xs text-[var(--muted)]">
                {publicFrame.tagline}
              </span>
            </span>
          </Link>
          {actions ? (
            <nav className="flex items-center gap-3 text-sm font-semibold">
              {actions}
            </nav>
          ) : null}
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-6xl items-center px-4 py-8 md:px-6 md:py-12">
        <section
          className={`mx-auto grid w-full gap-4 ${wide ? 'max-w-2xl' : 'max-w-md'}`}
        >
          <div className="shell-card grid gap-4 p-5 md:p-6">
            <div>
              <p className="shell-eyebrow">{eyebrow}</p>
              <h1 className="m-0 text-2xl font-bold tracking-normal text-[var(--ink)]">
                {title}
              </h1>
              <p className="mt-2 mb-0 text-sm leading-6 text-[var(--muted)]">
                {subtitle}
              </p>
            </div>
            {children}
          </div>
          {/* Every signed-out page links the statement: the store listings and
              the phone point at it, and so does anyone deciding whether to sign
              up. */}
          <footer className="text-center text-xs text-[var(--muted)]">
            <Link
              to="/privacy"
              className="text-[var(--muted)] underline-offset-2 hover:underline"
            >
              {messages.privacy.title}
            </Link>
          </footer>
        </section>
      </div>
    </main>
  )
}
