import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { StoreTile } from './StoreTile'

/**
 * A tile shows the bundled logo for a Catalog store and the monogram for
 * everything else: a custom store, a retired Catalog entry, a broken file.
 */

describe('a Catalog store with a logo', () => {
  test('shows the logo, named after the store', () => {
    renderWithI18n(
      <StoreTile name="Albert Heijn" color="#00A0E2" catalogKey="albert-heijn" />,
    )
    const logo = screen.getByRole('img', { name: 'Albert Heijn logo' })
    expect(logo.getAttribute('src')).toMatch(/albert-heijn-96\.webp/)
    expect(logo.getAttribute('srcset')).toMatch(
      /albert-heijn-96\.webp\S* 96w, \S*albert-heijn-192\.webp\S* 192w/,
    )
    expect(screen.queryByText('AH')).toBeNull()
    // It heads its page, so it loads at once.
    expect(logo.getAttribute('loading')).toBe('eager')
  })

  test('names it in Dutch too', () => {
    renderWithI18n(<StoreTile name="HEMA" catalogKey="hema" />, {
      locale: 'nl',
    })
    expect(screen.getByRole('img', { name: 'Logo van HEMA' })).toBeTruthy()
  })

  test('stays silent when the store is already named beside it', () => {
    const { container } = renderWithI18n(
      <StoreTile name="HEMA" catalogKey="hema" decorative />,
    )
    expect(screen.queryByRole('img')).toBeNull()
    // One row of many: it waits until scrolled to.
    expect(container.querySelector('img')?.getAttribute('loading')).toBe('lazy')
  })

  test('falls back to the monogram when the file fails to load', () => {
    renderWithI18n(<StoreTile name="Albert Heijn" catalogKey="albert-heijn" />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('AH')).toBeTruthy()
  })

  test('shows the next store’s logo after one failed', () => {
    const { rerender } = renderWithI18n(
      <StoreTile name="Albert Heijn" catalogKey="albert-heijn" />,
    )
    fireEvent.error(screen.getByRole('img'))
    rerender(<StoreTile name="HEMA" catalogKey="hema" />)
    expect(screen.getByRole('img', { name: 'HEMA logo' })).toBeTruthy()
  })
})

describe('the monogram', () => {
  test('stands in for a custom store', () => {
    renderWithI18n(<StoreTile name="Bakkerij de Hoek" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('BD')).toBeTruthy()
  })

  test('stands in for a card whose Catalog entry is gone', () => {
    renderWithI18n(<StoreTile name="V&D" catalogKey="vroom-en-dreesmann" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('VD')).toBeTruthy()
  })

  test('stands in for a Catalog store without a logo', () => {
    renderWithI18n(<StoreTile name="DreamLand" catalogKey="dreamland" />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('D')).toBeTruthy()
  })
})
