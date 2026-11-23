import { useUser } from '@clerk/react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  InsetList,
  InsetRow,
  SectionFooter,
  SectionLabel,
} from '../../components/app/InsetList'
import { useMessages } from '../i18n'
import {
  applyThemeMode,
  getInitialMode,
  setThemeMode,
  type ThemeMode,
} from './theme'

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
      // Merged server-side, so it cannot clobber a concurrent language write.
      user.updateMetadata({ unsafeMetadata: { theme: next } }).catch(() => {
        // non-fatal: local theme already applied
      })
    }
  }

  return (
    <section aria-labelledby="appearance-heading">
      <SectionLabel id="appearance-heading">{appearance.title}</SectionLabel>
      <InsetList>
        {OPTIONS.map(({ mode: optionMode, icon: Icon }) => (
          <InsetRow
            key={optionMode}
            title={appearance.modes[optionMode]}
            leading={<Icon className="size-5" aria-hidden="true" />}
            onClick={() => selectMode(optionMode)}
            selected={mode === optionMode}
            trailing={
              mode === optionMode ? (
                <Check
                  className="size-[18px] text-[var(--ink)]"
                  strokeWidth={2.6}
                  aria-hidden="true"
                />
              ) : undefined
            }
          />
        ))}
      </InsetList>
      <SectionFooter>{appearance.description}</SectionFooter>
    </section>
  )
}
