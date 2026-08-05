import { AppearanceSettings } from '@appelent/auth'
import { createFileRoute } from '@tanstack/react-router'
import { GroupSettingsLinks } from '../../components/settings/GroupSettingsLinks'
import { LanguageSettings } from '../../components/settings/LanguageSettings'
import { SampleDataSettings } from '../../components/settings/SampleDataSettings'
import { useMessages } from '../../lib/i18n'

/**
 * Your settings: the ones that are about you and read the same in every Group.
 *
 * Connections used to be here too. They are about a Group rather than about a
 * person, so they moved to `/g/<slug>/settings`; what is left in their place is
 * a way to get to each of your Groups' settings from where they used to be.
 */
export const Route = createFileRoute('/_app/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { settings } = useMessages()

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <h1 className="m-0 mb-4 text-xl font-semibold">{settings.title}</h1>
      {/* Language above appearance: it is the setting that changes the words
          of every other setting on this page, including its own. */}
      <LanguageSettings />
      <AppearanceSettings />
      <GroupSettingsLinks />
      {/* Renders nothing unless this build enabled sample data. Stays here
          rather than moving to a Group's settings with Connections: loading or
          resetting the sample household is about this deployment, not about
          whichever Group you happen to be standing in. */}
      <SampleDataSettings />
    </div>
  )
}
