import { AppearanceSettings } from '@appelent/auth'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings')({
  component: () => (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Settings</h1>
      <AppearanceSettings />
    </div>
  ),
})
