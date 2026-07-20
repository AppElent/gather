import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { WidgetInstance } from '../../lib/modules'
import { WidgetDashboard, type WidgetRendererRegistry } from './WidgetDashboard'

const snapshot: WidgetInstance[] = [
  { instanceId: 'b', widgetDefinitionId: 'notes.recent', size: 'wide' },
  { instanceId: 'a', widgetDefinitionId: 'tasks.today', size: 'compact' },
]

const renderers: WidgetRendererRegistry = {
  'notes.recent': ({ instance }) => (
    <div data-instance={instance.instanceId} data-testid="widget">
      Notes
    </div>
  ),
  'tasks.today': ({ instance }) => (
    <div data-instance={instance.instanceId} data-testid="widget">
      Tasks
    </div>
  ),
}

test('renders widgets in snapshot order and applies size classes', () => {
  render(
    <WidgetDashboard
      spaceSlug="wine"
      visibleModuleIds={['notes', 'tasks']}
      widgets={snapshot}
      renderers={renderers}
    />,
  )

  expect(
    screen.getAllByTestId('widget').map((node) => node.dataset.instance),
  ).toEqual(['b', 'a'])
  expect(document.querySelector('[data-widget-instance="b"]')).toHaveClass(
    'widget-wide',
  )
  expect(document.querySelector('[data-widget-instance="a"]')).toHaveClass(
    'widget-compact',
  )
})

test('contains one widget failure and retries without blanking Home', () => {
  let shouldThrow = true
  render(
    <WidgetDashboard
      spaceSlug="wine"
      visibleModuleIds={['notes', 'tasks']}
      widgets={snapshot}
      renderers={{
        'notes.recent': () => {
          if (shouldThrow) throw new Error('widget failed')
          return <div data-testid="widget">Recovered widget</div>
        },
        'tasks.today': () => <div data-testid="widget">Healthy widget</div>,
      }}
    />,
  )

  expect(screen.getByText('This widget could not load')).toBeInTheDocument()
  expect(screen.getByText('Healthy widget')).toBeInTheDocument()
  shouldThrow = false
  fireEvent.click(screen.getByRole('button', { name: 'Retry widget' }))
  expect(screen.getByText('Recovered widget')).toBeInTheDocument()
})

test('skips widgets from hidden modules without a stale placeholder', () => {
  render(
    <WidgetDashboard
      spaceSlug="wine"
      visibleModuleIds={['tasks']}
      widgets={snapshot}
      renderers={renderers}
    />,
  )

  expect(screen.queryByText('Notes')).toBeNull()
  expect(screen.getByText('Tasks')).toBeInTheDocument()
})
