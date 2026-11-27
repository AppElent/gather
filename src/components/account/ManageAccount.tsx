import { ACCOUNT_PORTAL_URL } from '@gather/core/account-portal'
import { ExternalLink } from 'lucide-react'
import { useMessages } from '../../lib/i18n'

/**
 * The way to the AppElent account portal, which opens in a new tab: the shared
 * login is managed there for every AppElent app.
 */
export function ManageAccount() {
  const { accountPortal } = useMessages().settings

  return (
    <section aria-labelledby="account-portal-title" className="rm-panel p-4">
      <h2 id="account-portal-title" className="rm-label">
        {accountPortal.title}
      </h2>
      <p className="m-0 mb-3 text-sm text-[var(--muted)]">
        {accountPortal.description}
      </p>
      <a
        href={ACCOUNT_PORTAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--hair)] px-3 text-sm font-semibold text-[var(--ink)] no-underline"
      >
        <ExternalLink className="size-4" aria-hidden="true" />
        {accountPortal.action}{' '}
        <span className="sr-only">{accountPortal.newTab}</span>
      </a>
    </section>
  )
}
