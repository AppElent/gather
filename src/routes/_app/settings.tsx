import { AppearanceSettings } from '@appelent/auth'
import { createFileRoute } from '@tanstack/react-router'
import { ConnectionsSettings } from '../../components/settings/ConnectionsSettings'

export const Route = createFileRoute('/_app/settings')({
  component: () => (
    <div className="mx-auto grid max-w-2xl gap-4">
      <h1 className="m-0 mb-4 text-xl font-semibold">Settings</h1>
      <AppearanceSettings />
      <ConnectionsSettings />
    </div>
  ),
})
