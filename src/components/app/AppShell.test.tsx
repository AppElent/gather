import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SpaceContextProvider } from '../spaces/SpaceContext'
import { AppShell } from './AppShell'

const routerState = vi.hoisted(() => ({
  location: { pathname: '/s/wine/home', hash: '' },
}))

vi.mock('@appelent/auth', () => ({
  HeaderUser: () => <div>Account menu</div>,
}))

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: null }),
}))

vi.mock('../spaces/SpaceSwitcher', () => ({
  SpaceSwitcher: () => <div>Wine Club</div>,
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>(
    '@tanstack/react-router',
  )
  return {
    ...actual,
    Link: ({ children, to, params, ...props }: any) => (
      <a
        href={String(to).replace('$spaceSlug', params?.spaceSlug ?? '')}
        {...props}
      >
        {children}
      </a>
    ),
    useLocation: () => routerState.location,
  }
})

function renderShell() {
  return render(
    <SpaceContextProvider
      value={{
        space: { slug: 'wine', name: 'Wine Club' },
        user: { name: 'Alex' },
        role: 'member',
        modules: [{ moduleId: 'recipes', state: 'enabled' }],
        navigation: { pinnedModuleIds: ['recipes'] },
        dashboard: { widgets: [] },
      }}
    >
      <AppShell>
        <div>Space route content</div>
      </AppShell>
    </SpaceContextProvider>,
  )
}

test('renders a calm two-column Space shell without the inspector or feed', () => {
  renderShell()

  expect(screen.getAllByText('Wine Club')).not.toHaveLength(0)
  expect(screen.getAllByRole('link', { name: 'Home' })).not.toHaveLength(0)
  expect(screen.getAllByRole('link', { name: 'Recipes' })).not.toHaveLength(0)
  expect(screen.getAllByRole('link', { name: 'All' })).not.toHaveLength(0)
  expect(screen.queryByLabelText('Group overview')).toBeNull()
  expect(screen.getByRole('main').textContent).toContain('Space route content')
})

test('opens and closes the compact navigation drawer', () => {
  renderShell()
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
  expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }))
  expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull()
})
