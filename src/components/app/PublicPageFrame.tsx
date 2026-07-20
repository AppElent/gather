import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

interface PublicPageFrameProps {
  eyebrow: string
  title: string
  subtitle: string
  children: ReactNode
  actions?: ReactNode
}

export function PublicPageFrame({
  eyebrow,
  title,
  subtitle,
  children,
  actions,
}: PublicPageFrameProps) {
  return (
    <main className="app-shell grid min-h-svh grid-rows-[auto_1fr] bg-[var(--app-bg)] text-[var(--app-fg)]">
      <header className="border-b border-[var(--app-border)] bg-[color-mix(in_oklch,var(--app-surface)_88%,transparent)]">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link
            to="/onboarding"
            className="flex min-w-0 items-center gap-2 text-[var(--app-fg)] no-underline"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] text-sm font-bold">
              G
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-sm">Gather</strong>
              <span className="block truncate text-xs text-[var(--app-muted)]">
                Spaces
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
        <section className="mx-auto grid w-full max-w-md gap-4">
          <div className="shell-card grid gap-4 p-5 md:p-6">
            <div>
              <p className="shell-eyebrow">{eyebrow}</p>
              <h1 className="m-0 text-2xl font-semibold tracking-normal text-[var(--app-fg)]">
                {title}
              </h1>
              <p className="mt-2 mb-0 text-sm leading-6 text-[var(--app-muted)]">
                {subtitle}
              </p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}
