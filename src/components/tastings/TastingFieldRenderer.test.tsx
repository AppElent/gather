import { fireEvent, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { renderWithI18n } from '../../lib/i18n/testing'
import { TastingFieldRenderer } from './TastingFieldRenderer'

test('renders all five field types and reports their values', () => {
  const text = vi.fn()
  const number = vi.fn()
  const scale = vi.fn()
  const select = vi.fn()
  const tags = vi.fn()

  renderWithI18n(
    <div>
      <TastingFieldRenderer
        field={{ key: 'producer', type: 'text' }}
        value={undefined}
        onChange={text}
      />
      <TastingFieldRenderer
        field={{ key: 'age', type: 'number', min: 0, max: 600 }}
        value={undefined}
        onChange={number}
      />
      <TastingFieldRenderer
        field={{ key: 'firmness', type: 'scale' }}
        value={undefined}
        onChange={scale}
      />
      <TastingFieldRenderer
        field={{ key: 'milk', type: 'select', vocabulary: 'milkType' }}
        value={undefined}
        onChange={select}
      />
      <TastingFieldRenderer
        field={{ key: 'aromas', type: 'tags', vocabulary: 'cheeseAroma' }}
        value={undefined}
        onChange={tags}
      />
    </div>,
  )

  fireEvent.change(screen.getByLabelText('Producer'), {
    target: { value: 'Remeker' },
  })
  fireEvent.change(screen.getByLabelText('Age'), {
    target: { value: '18' },
  })
  fireEvent.change(screen.getByLabelText('Firmness'), {
    target: { value: '4' },
  })
  fireEvent.change(screen.getByLabelText('Milk'), {
    target: { value: 'cow' },
  })
  fireEvent.change(screen.getByLabelText('Aromas'), {
    target: { value: 'nutty, toasted-hazelnut' },
  })

  expect(text).toHaveBeenLastCalledWith('Remeker')
  expect(number).toHaveBeenLastCalledWith(18)
  expect(scale).toHaveBeenLastCalledWith(4)
  expect(select).toHaveBeenLastCalledWith('cow')
  // A shipped vocabulary is a prompt, not a permission list.
  expect(tags).toHaveBeenLastCalledWith(['nutty', 'toasted-hazelnut'])
})
