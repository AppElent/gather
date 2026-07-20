import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { NavigationSettings } from '../../../../../components/settings/NavigationSettings'
import { useSpace } from '../../../../../components/spaces/SpaceContext'

export const Route = createFileRoute('/_app/s/$spaceSlug/settings/navigation')({
  component: SpaceNavigationSettings,
})

export function SpaceNavigationSettings() {
  const { role } = useSpace()
  const [mode, setMode] = useState<'space' | 'personal'>('space')

  if (role !== 'admin') return <NavigationSettings mode="personal" />

  return (
    <section className="grid gap-4">
      <nav className="flex flex-wrap gap-2" aria-label="Navigation editor mode">
        <button
          type="button"
          aria-pressed={mode === 'space'}
          onClick={() => setMode('space')}
        >
          Space menu
        </button>
        <button
          type="button"
          aria-pressed={mode === 'personal'}
          onClick={() => setMode('personal')}
        >
          My menu
        </button>
      </nav>
      <NavigationSettings mode={mode} />
    </section>
  )
}
