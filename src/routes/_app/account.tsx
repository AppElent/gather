import { createFileRoute } from '@tanstack/react-router'
import { ProfilePanel } from '@appelent/auth'

export const Route = createFileRoute('/_app/account')({
  component: () => (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold">Account</h1>
      <ProfilePanel />
    </div>
  ),
})
