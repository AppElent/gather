import { createFileRoute } from '@tanstack/react-router'
import { DataExportSettings } from '../../components/settings/DataExportSettings'
import { ProfilePanel } from '../../lib/auth'
import { useMessages } from '../../lib/i18n'

export const Route = createFileRoute('/_app/account')({
  component: AccountPage,
})

function AccountPage() {
  const { shell } = useMessages()
  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <h1 className="m-0 mb-4 text-xl font-semibold">
        {shell.routes.account.title}
      </h1>
      <ProfilePanel />
      <DataExportSettings />
    </div>
  )
}
