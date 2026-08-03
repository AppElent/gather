import { AppearanceSettings } from '@appelent/auth'
import { createFileRoute } from '@tanstack/react-router'
import { GroupSettingsLinks } from '../../components/settings/GroupSettingsLinks'
import { SampleDataSettings } from '../../components/settings/SampleDataSettings'

/**
 * Your settings: the ones that are about you and read the same in every Group.
 *
 * Connections used to be here too. They are about a Group rather than about a
 * person, so they moved to `/g/<slug>/settings`; what is left in their place is
 * a way to get to each of your Groups' settings from where they used to be.
 */
export const Route = createFileRoute('/_app/settings')({
  component: () => (
    <div className="mx-auto grid max-w-2xl gap-4">
      <h1 className="m-0 mb-4 text-xl font-semibold">Settings</h1>
      <AppearanceSettings />
      <GroupSettingsLinks />
      {/* Renders nothing unless this build enabled sample data. Stays here
          rather than moving to a Group's settings with Connections: loading or
          resetting the sample household is about this deployment, not about
          whichever Group you happen to be standing in. */}
      <SampleDataSettings />
    </div>
  ),
})
