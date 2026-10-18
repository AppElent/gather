import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const update = vi.fn()
const clerk = vi.hoisted(() => ({
  user: null as null | {
    id: string
    unsafeMetadata: Record<string, unknown>
    update: typeof update
  },
}))
vi.mock('@clerk/clerk-react', () => ({ useUser: () => clerk }))

import { createLanguageSync } from './clerk-sync'
import { createI18n } from './index'

const LOCALES = ['en', 'nl'] as const
const { LocaleProvider, useI18n, hasExplicitLocaleChoice } = createI18n({
  locales: LOCALES,
  fallback: 'en',
  messages: { en: { hello: 'Hello' }, nl: { hello: 'Hallo' } },
})
const LanguageSync = createLanguageSync({
  useI18n,
  hasExplicitLocaleChoice,
  locales: LOCALES,
})

function Greeting() {
  const { messages, setLocale } = useI18n()
  return (
    <button type="button" onClick={() => setLocale('nl')}>
      {messages.hello}
    </button>
  )
}

function clearLangCookie() {
  // biome-ignore lint/suspicious/noDocumentCookie: resetting the cookie the runtime writes.
  document.cookie = 'lang=; path=/; max-age=0'
}

describe('i18n runtime', () => {
  afterEach(() => {
    clearLangCookie()
    update.mockReset()
    clerk.user = null
  })

  it('switches language and records the choice as explicit', () => {
    render(
      <LocaleProvider initialLocale="en">
        <Greeting />
      </LocaleProvider>,
    )
    expect(hasExplicitLocaleChoice()).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Hello' }))

    expect(screen.getByRole('button', { name: 'Hallo' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('nl')
    expect(hasExplicitLocaleChoice()).toBe(true)
  })

  it('adopts the language saved on the user when none was chosen here', async () => {
    update.mockResolvedValue({})
    clerk.user = { id: 'u1', unsafeMetadata: { language: 'nl' }, update }
    render(
      <LocaleProvider initialLocale="en">
        <LanguageSync />
        <Greeting />
      </LocaleProvider>,
    )
    await act(async () => {})

    expect(screen.getByRole('button', { name: 'Hallo' })).toBeInTheDocument()
  })

  it('mirrors an explicit choice onto the user', async () => {
    update.mockResolvedValue({})
    // biome-ignore lint/suspicious/noDocumentCookie: an explicit choice made earlier on this device.
    document.cookie = 'lang=en; path=/'
    clerk.user = { id: 'u1', unsafeMetadata: { language: 'nl' }, update }
    render(
      <LocaleProvider initialLocale="en">
        <LanguageSync />
        <Greeting />
      </LocaleProvider>,
    )
    await act(async () => {})

    expect(screen.getByRole('button', { name: 'Hello' })).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({
      unsafeMetadata: { language: 'en' },
    })
  })
})
