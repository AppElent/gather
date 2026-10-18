import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderWithI18n } from '../i18n/testing'
import { AuthButton } from './AuthButton'
import { AuthError } from './AuthError'
import { AuthField } from './AuthField'

describe('auth primitives', () => {
  afterEach(cleanup)

  it('AuthField renders label and shows error text', () => {
    renderWithI18n(
      <AuthField
        label="Email"
        type="email"
        value=""
        onChange={() => {}}
        error="Required"
      />,
    )
    expect(screen.getByLabelText('Email')).toBeDefined()
    expect(screen.getByText('Required')).toBeDefined()
  })

  it('AuthField links the input to its error via aria-describedby', () => {
    renderWithI18n(
      <AuthField
        label="Email"
        type="email"
        value=""
        onChange={() => {}}
        error="Required"
      />,
    )
    const describedBy = screen
      .getByLabelText('Email')
      .getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)?.textContent).toBe(
      'Required',
    )
  })

  it('AuthField has no aria-describedby without an error', () => {
    renderWithI18n(
      <AuthField label="Email" type="email" value="" onChange={() => {}} />,
    )
    expect(
      screen.getByLabelText('Email').getAttribute('aria-describedby'),
    ).toBeNull()
  })

  it('AuthButton shows loading and disables', () => {
    renderWithI18n(<AuthButton loading>Sign in</AuthButton>)
    const btn = screen.getByRole('button')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('AuthButton sets aria-busy while loading and clears it when idle', () => {
    const { rerender } = renderWithI18n(
      <AuthButton loading>Sign in</AuthButton>,
    )
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true')
    rerender(<AuthButton>Sign in</AuthButton>)
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('false')
  })

  it('AuthError renders nothing when message is empty', () => {
    const { container } = renderWithI18n(<AuthError message={null} />)
    expect(container.firstChild).toBeNull()
  })
})
