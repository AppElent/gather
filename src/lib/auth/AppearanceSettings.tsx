import { useUser } from '@clerk/clerk-react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMessages } from '../i18n'
import {
  applyThemeMode,
  getInitialMode,
  setThemeMode,
  type ThemeMode,
} from './theme'
import { cn } from './utils'

const OPTIONS: { mode: ThemeMode; icon: typeof Sun }[] = [
  { mode: 'light', icon: Sun },
  { mode: 'auto', icon: Monitor },
  { mode: 'dark', icon: Moon },
]

export function AppearanceSettings() {
  const [mode, setMode] = useState<ThemeMode>('auto')
  const { user } = useUser()
  const { appearance } = useMessages().settings

  useEffect(() => {
    setMode(getInitialMode())
  }, [])

  useEffect(() => {
    if (mode !== 'auto') {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyThemeMode('auto')

    media.addEventListener('change', onChange)
    return () => {
      media.removeEventListener('change', onChange)
    }
  }, [mode])

  function selectMode(next: ThemeMode) {
    setMode(next)
    setThemeMode(next)
    if (user) {
      user
        .update({ unsafeMetadata: { ...user.unsafeMetadata, theme: next } })
        .catch(() => {
          // non-fatal: local theme already applied
        })
    }
  }

  return (
    <section className="rm-panel p-4">
      <p className="rm-label">{appearance.title}</p>
      <p className="mt-1 text-sm text-[var(--auth-muted)]">
        {appearance.description}
      </p>
      <div className="mt-3 inline-flex gap-1 rounded-md border border-[var(--auth-border)] p-1">
        {OPTIONS.map(({ mode: optionMode, icon: Icon }) => (
          <button
            key={optionMode}
            type="button"
            onClick={() => selectMode(optionMode)}
            aria-pressed={mode === optionMode}
            className={cn(
              'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition',
              mode === optionMode
                ? 'bg-[var(--auth-accent)] text-[var(--auth-accent-fg)]'
                : 'text-[var(--auth-muted)] hover:bg-[var(--auth-border)]',
            )}
          >
            <Icon size={15} /> {appearance.modes[optionMode]}
          </button>
        ))}
      </div>
    </section>
  )
}
