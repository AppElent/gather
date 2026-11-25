import { fireEvent, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, test } from 'vitest'
import { InsetList, InsetRow } from './InsetList'
import { DetailPanelHeader, DetailPanelTabs, ListDetailLayout } from './ListDetailLayout'
import { renderInGroup } from './testing'
import { useMenu } from './useMenu'

function Page({ wide }: { wide?: 'list' | 'panel' }) {
  const [open, setOpen] = useState<string>()
  return (
    <ListDetailLayout
      header={<h1>Things</h1>}
      wide={wide}
      width={340}
      recordKey={open}
      onCloseRecord={() => setOpen(undefined)}
      panelLabel="Panel"
      list={
        <InsetList label="Things">
          {['One', 'Two'].map((name) => (
            <InsetRow
              key={name}
              title={name}
              selected={open === name}
              onClick={() => setOpen(name)}
            />
          ))}
        </InsetList>
      }
      panel={
        open ? (
          <DetailPanelHeader title={open} onClose={() => setOpen(undefined)} />
        ) : (
          <p>Nothing open</p>
        )
      }
    />
  )
}

const row = (name: string) => screen.getByRole('button', { name })
const panel = () => screen.getByRole('complementary', { hidden: true })
const open = (name: string) => {
  row(name).focus()
  fireEvent.click(row(name))
}

describe('ListDetailLayout', () => {
  test('opening a record moves focus to the panel; Escape closes it and returns', () => {
    renderInGroup(<Page />)
    open('Two')
    expect(document.activeElement).toBe(panel())
    fireEvent.keyDown(panel(), { key: 'Escape' })
    expect(screen.getByText('Nothing open')).toBeTruthy()
    expect(document.activeElement).toBe(row('Two'))
  })

  test('the Close button returns focus to the row too', () => {
    renderInGroup(<Page />)
    open('One')
    const close = screen.getByRole('button', { name: 'Close panel' })
    close.focus()
    fireEvent.click(close)
    expect(document.activeElement).toBe(row('One'))
  })

  test('Escape something inside already handled leaves the record open', () => {
    renderInGroup(<Page />)
    open('One')
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    event.preventDefault()
    fireEvent(panel(), event)
    expect(screen.getByRole('heading', { name: 'One' })).toBeTruthy()
  })

  test('arrows move between rows', () => {
    renderInGroup(<Page />)
    row('One').focus()
    fireEvent.keyDown(row('One'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(row('Two'))
    fireEvent.keyDown(row('Two'), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(row('Two'))
    fireEvent.keyDown(row('Two'), { key: 'ArrowUp' })
    expect(document.activeElement).toBe(row('One'))
  })

  test('below lg an open record takes the list’s place', () => {
    renderInGroup(<Page />)
    expect(panel().className).toContain('max-lg:hidden')
    open('One')
    expect(panel().className).not.toContain('max-lg:hidden')
    expect(
      row('One').closest('[data-layout] > div')?.className,
    ).toContain('max-lg:hidden')
  })

  test('either column can be the fixed one', () => {
    const { container, unmount } = renderInGroup(<Page />)
    const grid = (root: Element) =>
      root.querySelector<HTMLElement>('[data-layout="list-detail"]')
    expect(grid(container)?.style.getPropertyValue('--fixed-column')).toBe('340px')
    expect(grid(container)?.className).toContain('minmax(0,1fr)_var(--fixed-column)')
    unmount()
    const notes = renderInGroup(<Page wide="panel" />)
    expect(grid(notes.container)?.className).toContain('var(--fixed-column)_minmax(0,1fr)')
  })

  test('a page’s max width replaces the default instead of competing with it', () => {
    const { container } = renderInGroup(
      <ListDetailLayout header={null} list={null} maxWidth="max-w-5xl" />,
    )
    const root = container.querySelector('[data-layout]')?.parentElement
    expect(root?.className.match(/max-w-\S+/g)).toEqual(['max-w-5xl'])
  })
})

test('DetailPanelTabs roves with the arrow keys', () => {
  const picked: string[] = []
  renderInGroup(
    <DetailPanelTabs
      label="Tabs"
      activeId="a"
      onSelect={(id) => picked.push(id)}
      tabs={[
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]}
    />,
  )
  fireEvent.keyDown(screen.getByRole('tab', { name: 'A' }), { key: 'ArrowRight' })
  expect(picked).toEqual(['b'])
  expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'B' }))
})

function Menu() {
  const menu = useMenu()
  return (
    <>
      <button {...menu.button}>Open</button>
      {menu.open ? (
        <div {...menu.menu} aria-label="Choices">
          <button type="button" role="menuitemradio" aria-checked={false}>
            A
          </button>
          <button type="button" role="menuitemradio" aria-checked>
            B
          </button>
        </div>
      ) : null}
    </>
  )
}

test('useMenu opens on the choice, moves with the arrows, and Escape returns', () => {
  renderInGroup(<Menu />)
  const button = screen.getByRole('button', { name: 'Open' })
  fireEvent.click(button)
  const item = (name: string) => screen.getByRole('menuitemradio', { name })
  expect(document.activeElement).toBe(item('B'))
  fireEvent.keyDown(item('B'), { key: 'ArrowDown' })
  expect(document.activeElement).toBe(item('A'))
  fireEvent.keyDown(item('A'), { key: 'Escape' })
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(button)
})
