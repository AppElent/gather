import { createFileRoute, Link } from '@tanstack/react-router'
import { AccountDeleteSettings } from '../../components/account/AccountDeleteSettings'
import { ManageAccount } from '../../components/account/ManageAccount'
import { SignedInDevices } from '../../components/account/SignedInDevices'
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
      <h1 className="m-0 mb-4 text-xl font-bold">
        {messages.shell.routes.account.title}
      </h1>
      <ProfilePanel />
      <ManageAccount />
      <SignedInDevices />
      <DataExportSettings />
      <AccountDeleteSettings />
      <p className="m-0 text-sm text-[var(--muted)]">
        <Link to="/privacy" className="underline-offset-2 hover:underline">
          {messages.privacy.title}
        </Link>
      </p>
    </div>
  )
}
