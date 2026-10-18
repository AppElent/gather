import { createFileRoute, Link } from '@tanstack/react-router'
import { DataExportSettings } from '../../components/settings/DataExportSettings'
import { ProfilePanel } from '../../lib/auth'
import { useMessages } from '../../lib/i18n'

export const Route = createFileRoute('/_app/account')({
  component: AccountPage,
})

function AccountPage() {
  const messages = useMessages()

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <h1 className="m-0 mb-4 text-xl font-semibold">
        {messages.shell.routes.account.title}
      </h1>
      <ProfilePanel />
      <DataExportSettings />
      <p className="m-0 text-sm text-[var(--app-muted)]">
        <Link to="/privacy" className="underline-offset-2 hover:underline">
          {messages.privacy.title}
        </Link>
      </p>
    </div>
  )
}
