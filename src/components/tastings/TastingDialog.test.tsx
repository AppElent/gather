import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Id } from '../../../convex/_generated/dataModel'
import { renderWithI18n } from '../../lib/i18n/testing'
import { TastingDialog } from './TastingDialog'

const data = vi.hoisted(() => ({
  subjects: [
    {
      _id: 'subject_gouda' as Id<'tastingSubjects'>,
      name: 'Gouda',
      kind: 'cheese',
      attributes: { milk: 'cow' },
      photoUrl: null,
      average: 4,
      count: 2,
    },
  ],
  catalog: [
    {
      seedKey: 'cheese:comte',
      name: 'Comté',
      attributes: { milk: 'cow', country: 'france' },
    },
  ],
}))

vi.mock('convex/react', () => ({
  useQuery: (name: string) =>
    name === 'tastings:listByKind' ? data.subjects : data.catalog,
  useMutation: () => vi.fn(),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    tastings: {
      listByKind: 'tastings:listByKind',
      catalogByKind: 'tastings:catalogByKind',
      logTasting: 'tastings:logTasting',
      updateTasting: 'tastings:updateTasting',
    },
  },
}))

beforeEach(() => vi.clearAllMocks())

function renderDialog() {
  return renderWithI18n(
    <TastingDialog
      open
      kind="cheese"
      groupSlug="household"
      groupName="Household"
      onClose={vi.fn()}
    />,
  )
}

test('choosing a catalog subject prefills its name and facts', () => {
  renderDialog()
  fireEvent.click(screen.getByRole('button', { name: /Comté/i }))

  expect(screen.getByLabelText('Name')).toHaveValue('Comté')
  expect(screen.getByLabelText('Milk')).toHaveValue('cow')
  expect(screen.getByLabelText('Country')).toHaveValue('france')
})

test('a matching name warns but still allows creating another subject', () => {
  renderDialog()
  fireEvent.change(screen.getByLabelText('Search or type a name'), {
    target: { value: 'Gouda' },
  })

  expect(screen.getByText(/you already have Gouda/i)).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: /add “Gouda”/i }))
  expect(screen.getByLabelText('Name')).toHaveValue('Gouda')
})
