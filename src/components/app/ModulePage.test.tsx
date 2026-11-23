import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { dateInWords, rowDate } from '../../lib/rowDate'
import { CompletedSection } from './CompletedSection'
import { Dialog } from './Dialog'
import { EmptyState } from './EmptyState'
import { InsetList, InsetRow, SectionLabel } from './InsetList'
import { RowMenu } from './RowMenu'
import { WashHeader } from './WashHeader'

/**
 * The Module page's building blocks (APP-639): what each one is called to
 * assistive technology, how the row menu answers the keyboard, and the dialog
 * that becomes a sheet below `lg`.
 */

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params: _params,
    ...rest
  }: {
    children: React.ReactNode
    to: string
    params?: unknown
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

/** jsdom has no media queries; this says whether the window is `lg`. */
function setDesktop(desktop: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: desktop,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  // @ts-expect-error jsdom's default: no matchMedia at all.
  delete window.matchMedia
})

describe('WashHeader', () => {
  test('names its buttons after the Module, in either language', () => {
    renderWithI18n(
      <WashHeader
        group="kitchen"
        icon="ChefHat"
        title="Recepten"
        summary={{ count: '12 recepten', scope: 'Willow Street' }}
        onSearch={() => {}}
        settings={{ to: '/settings' }}
        primary={{ label: 'Recept toevoegen', link: { to: '/recipes/new' } }}
      />,
      { locale: 'nl' },
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Recepten' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Zoeken in Recepten' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Instellingen van Recepten' }),
    ).toHaveAttribute('href', '/settings')
    expect(
      screen.getByRole('link', { name: 'Recept toevoegen' }),
    ).toHaveAttribute('href', '/recipes/new')
    expect(screen.getByTestId('wash-summary')).toHaveTextContent(
      '12 recepten · Willow Street',
    )
  })

  test('draws no gear for a Module without settings, and no search without one', () => {
    renderWithI18n(<WashHeader group="home" icon="ListTodo" title="Tasks" />)
    expect(screen.queryByRole('link', { name: /Settings for/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Search in/ })).toBeNull()
  })

  test('a nested page links to its parent above the title', () => {
    renderWithI18n(
      <WashHeader
        group="home"
        icon="ListTodo"
        title="House"
        parent={{ label: 'Tasks', link: { to: '/tasks' } }}
      />,
    )
    expect(screen.getByRole('link', { name: 'Tasks' })).toHaveAttribute(
      'href',
      '/tasks',
    )
  })
})

describe('InsetRow', () => {
  test('a link row is named by its title and its menu is a separate control', () => {
    renderWithI18n(
      <InsetList label="Recipes">
        <InsetRow
          title="Shakshuka"
          footnote="★★★★★ · brunch"
          link={{ to: '/recipes/$recipeId', params: { recipeId: '1' } }}
          menu={
            <RowMenu
              item="Shakshuka"
              actions={[{ id: 'pin', label: 'Pin', onSelect: () => {} }]}
            />
          }
        />
        <InsetRow title="Tarka dal" link={{ to: '/recipes/$recipeId', params: { recipeId: '2' } }} />
      </InsetList>,
    )
    const list = screen.getByRole('list', { name: 'Recipes' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Shakshuka' })).toHaveAttribute(
      'href',
      '/recipes/$recipeId',
    )
    expect(
      screen.getByRole('button', { name: 'Actions for Shakshuka' }),
    ).toHaveAttribute('aria-haspopup', 'menu')
  })

  test('a section label is a heading', () => {
    renderWithI18n(<SectionLabel>Your pins</SectionLabel>)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Your pins' }),
    ).toBeInTheDocument()
  })
})

describe('RowMenu', () => {
  function setup() {
    const selected: string[] = []
    renderWithI18n(
      <RowMenu
        item="Tasks"
        actions={[
          { id: 'up', label: 'Move up', onSelect: () => selected.push('up') },
          { id: 'unpin', label: 'Unpin', onSelect: () => selected.push('unpin') },
          {
            id: 'delete',
            label: 'Delete',
            danger: true,
            onSelect: () => selected.push('delete'),
          },
        ]}
      />,
    )
    const button = screen.getByRole('button', { name: 'Actions for Tasks' })
    return { button, selected }
  }

  test('opens on click with focus on the first item, and closes on Escape back to the button', () => {
    const { button } = setup()
    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  test('arrows, Home and End move through the items and wrap', () => {
    const { button } = setup()
    fireEvent.keyDown(button, { key: 'ArrowUp' })
    const menu = screen.getByRole('menu')
    const items = within(menu).getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[2])
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(menu, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(items[2])
    fireEvent.keyDown(menu, { key: 'Home' })
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(menu, { key: 'End' })
    expect(document.activeElement).toBe(items[2])
  })

  test('choosing an item runs it and closes the menu', () => {
    const { button, selected } = setup()
    fireEvent.keyDown(button, { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Unpin' }))
    expect(selected).toEqual(['unpin'])
    expect(screen.queryByRole('menu')).toBeNull()
  })

  test('a click outside closes it', () => {
    const { button } = setup()
    fireEvent.click(button)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('CompletedSection', () => {
  test('is collapsed, says its count, and opens in place', () => {
    renderWithI18n(
      <CompletedSection count={3}>
        <p>done rows</p>
      </CompletedSection>,
      { locale: 'nl' },
    )
    const toggle = screen.getByRole('button', { name: 'Voltooid (3)' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('done rows')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('done rows')).toBeInTheDocument()
  })

  test('is not there at all with nothing completed', () => {
    const { container } = renderWithI18n(
      <CompletedSection count={0}>
        <p>done rows</p>
      </CompletedSection>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})

describe('EmptyState', () => {
  test('nothing yet offers one add action', () => {
    const onClick = vi.fn()
    renderWithI18n(
      <EmptyState
        kind="nothing-yet"
        title="No recipes yet"
        action={{ label: 'Add your first recipe', onClick }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add your first recipe' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  test('nothing found offers a way to clear', () => {
    renderWithI18n(
      <EmptyState
        kind="nothing-found"
        title="Nothing found"
        action={{ label: 'Clear filters', onClick: () => {} }}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Clear filters' }),
    ).toBeInTheDocument()
  })

  test('nothing here for you offers no action, even when given one', () => {
    renderWithI18n(
      <EmptyState
        kind="nothing-for-you"
        title="Nothing assigned to you"
        action={{ label: 'Add', onClick: () => {} }}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('Dialog', () => {
  function open() {
    const onClose = vi.fn()
    renderWithI18n(
      <>
        <button type="button">opener</button>
        <Dialog
          title="New task"
          onClose={onClose}
          actions={<button type="button">Add</button>}
        >
          <input aria-label="Task" />
        </Dialog>
      </>,
    )
    return { onClose, dialog: screen.getByRole('dialog', { name: 'New task' }) }
  }

  test('below lg it is a bottom sheet with a grabber', () => {
    setDesktop(false)
    const { dialog } = open()
    expect(dialog).toHaveAttribute('data-presentation', 'sheet')
    expect(dialog.querySelector('[data-grabber]')).not.toBeNull()
  })

  test('at lg it is a centred dialog without one', () => {
    setDesktop(true)
    const { dialog } = open()
    expect(dialog).toHaveAttribute('data-presentation', 'dialog')
    expect(dialog.querySelector('[data-grabber]')).toBeNull()
  })

  test('focus moves in, Escape and the close button close it', () => {
    const { onClose, dialog } = open()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('row dates', () => {
  test('read as words, and as overdue in danger once past', () => {
    expect(dateInWords('2026-12-04', 'nl')).toBe('vr 4 dec')
    expect(rowDate('2026-12-04', '2026-11-23', 'nl', 'Te laat · {date}')).toEqual(
      { text: 'vr 4 dec', overdue: false },
    )
    expect(rowDate('2026-11-20', '2026-11-23', 'nl', 'Te laat · {date}')).toEqual(
      { text: 'Te laat · vr 20 nov', overdue: true },
    )
    expect(rowDate('2026-11-20', '2026-11-23', 'en', 'Overdue · {date}').text).toBe(
      'Overdue · Fri, Nov 20',
    )
  })
})

