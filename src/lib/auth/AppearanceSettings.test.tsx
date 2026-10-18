import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// jsdom ships without matchMedia, which the component reads on mount.
beforeAll(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
})

const update = vi.fn()
const user = { unsafeMetadata: { language: 'nl' }, update }
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user }),
}))

import { renderWithI18n } from '../i18n/testing'
import { AppearanceSettings } from './AppearanceSettings'

describe('AppearanceSettings', () => {
  afterEach(() => {
    update.mockReset()
    localStorage.clear()
    document.documentElement.className = ''
  })

  it('names Gather in the reader’s language', () => {
    renderWithI18n(<AppearanceSettings />, { locale: 'nl' })
    expect(screen.getByText('Weergave')).toBeInTheDocument()
    expect(screen.getByText(/Kies hoe Gather eruitziet/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Donker/ })).toBeInTheDocument()
    expect(screen.queryByText(/ArchStudio/)).toBeNull()
  })

  it('applies a choice, keeps it locally and mirrors it onto the user', () => {
    update.mockResolvedValue({})
    renderWithI18n(<AppearanceSettings />)

    fireEvent.click(screen.getByRole('button', { name: /Dark/ }))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(update).toHaveBeenCalledWith({
      unsafeMetadata: { language: 'nl', theme: 'dark' },
    })
    expect(
      screen.getByRole('button', { name: /Dark/ }).getAttribute('aria-pressed'),
    ).toBe('true')
  })
})
