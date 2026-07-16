import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { AppShell } from './AppShell'

const routerState = vi.hoisted(() => ({
  location: { pathname: '/recipes', hash: '' },
}))

vi.mock('@appelent/auth', () => ({
  HeaderUser: () => <div>Account menu</div>,
}))

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: null }),
}))

vi.mock('./CommandPalette', () => ({
  CommandPalette: () => null,
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    Link: ({
      children,
      to,
      className,
      onClick,
    }: {
      children: React.ReactNode
      to: string
      className?: string
      onClick?: React.MouseEventHandler<HTMLAnchorElement>
    }) => (
      <a
        href={to}
        className={className}
        onClick={(event) => {
          event.preventDefault()
          onClick?.(event)
        }}
      >
        {children}
      </a>
    ),
    useLocation: () => routerState.location,
  }
})

test('renders redesigned shell navigation and route content', () => {
  render(
    <AppShell>
      <div>Recipe route content</div>
    </AppShell>,
  )

  expect(screen.getByText('Gather')).toBeDefined()
  expect(screen.getAllByText('Preview group').length).toBeGreaterThan(0)
  expect(screen.getByRole('link', { name: /Command Center/i })).toBeDefined()
  expect(screen.getByRole('link', { name: /Recipes/i })).toBeDefined()
  expect(screen.getByRole('heading', { name: 'Recipes' })).toBeDefined()
  expect(screen.getByText('Recipe route content')).toBeDefined()
  expect(screen.getByRole('main').textContent).toContain('Recipe route content')
})

test('renders mobile dock targets', () => {
  render(
    <AppShell>
      <main>Content</main>
    </AppShell>,
  )

  const dock = screen.getByRole('navigation', { name: 'Mobile navigation' })
  expect(dock).toBeDefined()
  expect(within(dock).getByRole('link', { name: /Home/i })).toBeDefined()
  expect(within(dock).getByRole('link', { name: /Tasks/i })).toBeDefined()
  expect(within(dock).getByRole('link', { name: /Calendar/i })).toBeDefined()
  expect(within(dock).getByRole('link', { name: /Modules/i })).toBeDefined()
})

test('shows the group inspector by the desktop breakpoint', () => {
  render(
    <AppShell>
      <main>Content</main>
    </AppShell>,
  )

  const inspector = screen.getByRole('complementary', {
    name: 'Group overview',
  })
  expect(inspector.parentElement?.className).toContain('xl:block')
  expect(inspector.parentElement?.parentElement?.className).toContain(
    'xl:grid-cols-[264px_minmax(0,1fr)_336px]',
  )
})

test('keeps dashboard primary navigation active state exclusive by hash', () => {
  routerState.location = { pathname: '/dashboard', hash: 'modules' }
  render(
    <AppShell>
      <div>Content</div>
    </AppShell>,
  )

  const primary = screen.getByRole('navigation', { name: 'Primary' })
  expect(
    within(primary).getByRole('link', { name: 'Command Center' }).className,
  ).not.toContain('border-[var(--app-fg)]')
  expect(
    within(primary).getByRole('link', { name: 'Modules' }).className,
  ).toContain('border-[var(--app-fg)]')

  const mobileGroupLabel = screen
    .getAllByText('Preview group')
    .find((element) => element.className.includes('md:hidden'))
  expect(mobileGroupLabel?.className).toContain('md:hidden')

  routerState.location = { pathname: '/recipes', hash: '' }
})

test('opens navigation drawer and Gather panel from topbar actions', () => {
  render(
    <AppShell>
      <main>Content</main>
    </AppShell>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
  expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeDefined()

  fireEvent.click(screen.getByRole('button', { name: 'Ask Gather' }))
  expect(screen.getByRole('dialog', { name: 'Ask Gather' })).toBeDefined()
})

test('manages drawer focus and closes from controls, Escape, and navigation', () => {
  render(
    <AppShell>
      <main>Content</main>
    </AppShell>,
  )

  const opener = screen.getByRole('button', { name: 'Open navigation' })
  opener.focus()
  fireEvent.click(opener)

  const drawer = screen.getByRole('dialog', { name: 'Navigation' })
  const closeButton = within(drawer).getByRole('button', {
    name: 'Close navigation',
  })
  const lastLink = within(drawer).getByRole('link', { name: 'Settings' })

  expect(document.activeElement).toBe(closeButton)

  fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
  expect(document.activeElement).toBe(lastLink)

  fireEvent.keyDown(lastLink, { key: 'Tab' })
  expect(document.activeElement).toBe(closeButton)

  fireEvent.click(closeButton)
  expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
  expect(document.activeElement).toBe(opener)

  fireEvent.click(opener)
  fireEvent.click(
    within(screen.getByRole('dialog', { name: 'Navigation' })).getByRole(
      'link',
      { name: 'Command Center' },
    ),
  )
  expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()

  fireEvent.click(opener)
  const backdrop = screen.getByTestId('navigation-backdrop')
  expect(backdrop.className).toContain('overflow-y-auto')
  fireEvent.click(backdrop)
  expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()

  fireEvent.click(opener)
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'Navigation' }), {
    key: 'Escape',
  })
  expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
})
