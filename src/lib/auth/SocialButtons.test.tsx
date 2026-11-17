import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const sso = vi.fn()
vi.mock('@clerk/react', () => ({ useSignIn: () => ({ signIn: { sso } }) }))

import { renderWithI18n } from '../i18n/testing'
import { AuthConfigProvider, DEFAULT_AUTH_CONFIG } from './AuthConfigProvider'
import { SocialButtons } from './SocialButtons'
import type { AuthConfig } from './types'

const CONFIG: AuthConfig = {
  ...DEFAULT_AUTH_CONFIG,
  socialProviders: [
    { id: 'apple', label: 'Apple', strategy: 'oauth_apple' },
    { id: 'microsoft', label: 'Microsoft', strategy: 'oauth_microsoft' },
  ],
}

function renderButtons(config = CONFIG, locale: 'en' | 'nl' = 'en') {
  return renderWithI18n(
    <AuthConfigProvider config={config}>
      <SocialButtons />
    </AuthConfigProvider>,
    { locale },
  )
}

describe('SocialButtons', () => {
  afterEach(() => {
    cleanup()
    sso.mockReset()
  })

  it('draws nothing when no provider is configured', () => {
    const { container } = renderButtons(DEFAULT_AUTH_CONFIG)
    expect(container.textContent).toBe('')
  })

  it('offers Apple and Microsoft', () => {
    renderButtons()
    expect(
      screen.getByRole('button', { name: 'Continue with Apple' }),
    ).toBeDefined()
    expect(
      screen.getByRole('button', { name: 'Continue with Microsoft' }),
    ).toBeDefined()
  })

  it('redirects to the provider and back through the SSO callback', () => {
    sso.mockResolvedValue({ error: null })
    renderButtons()
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Apple' }))
    expect(sso).toHaveBeenCalledWith({
      strategy: 'oauth_apple',
      redirectCallbackUrl: '/sso-callback',
      redirectUrl: '/',
    })
  })

  it('shows the error when the redirect cannot start, and frees the buttons', async () => {
    sso.mockResolvedValue({
      error: { errors: [{ message: 'Provider disabled.' }] },
    })
    renderButtons()
    fireEvent.click(
      screen.getByRole('button', { name: 'Continue with Microsoft' }),
    )
    expect(await screen.findByText('Provider disabled.')).toBeDefined()
    const apple = screen.getByRole('button', {
      name: 'Continue with Apple',
    }) as HTMLButtonElement
    expect(apple.disabled).toBe(false)
  })

  it('blocks every provider while one redirect is starting', () => {
    sso.mockReturnValue(new Promise(() => {}))
    renderButtons()
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Apple' }))
    const microsoft = screen.getByRole('button', {
      name: 'Continue with Microsoft',
    }) as HTMLButtonElement
    expect(microsoft.disabled).toBe(true)
    fireEvent.click(microsoft)
    expect(sso).toHaveBeenCalledTimes(1)
  })

  it('speaks Dutch', () => {
    renderButtons(CONFIG, 'nl')
    expect(
      screen.getByRole('button', { name: 'Doorgaan met Microsoft' }),
    ).toBeDefined()
    expect(screen.getByText('of')).toBeDefined()
  })
})
