import { ProfilePanel } from '@appelent/auth'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMessages } from '../../lib/i18n'

export const Route = createFileRoute('/_app/account')({
  component: AccountPage,
})

function AccountPage() {
  const messages = useMessages()

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">
        {messages.shell.routes.account.title}
      </h1>
      <ProfilePanel />
      <p className="mt-4 text-sm text-[var(--app-muted)]">
        <Link to="/privacy" className="underline-offset-2 hover:underline">
          {messages.privacy.title}
        </Link>
      </p>
    </div>
  )
}
