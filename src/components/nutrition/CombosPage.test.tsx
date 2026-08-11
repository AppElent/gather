import { screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ComboComponent } from '../../../convex/lib/combos'
import { renderWithI18n } from '../../lib/i18n/testing'
import { CombosPage } from './CombosPage'
import { groupNutritionNav } from './nutritionNav'

/**
 * The Combos library (#100): somewhere to see what you have saved, rather than
 * only meeting them inside the add sheet.
 *
 * It reads `combos.list`, which resolves the caller and returns their own rows
 * and nothing else (ADR-0012) — so there is no Group argument here to get
 * wrong, and none is invented.
 */

const combos = vi.hoisted(() => ({ value: undefined as unknown }))
const queried = vi.hoisted(() => ({ value: [] as unknown[] }))

vi.mock('convex/react', () => ({
  useQuery: (name: string, args: unknown) => {
    queried.value.push([name, args])
    return combos.value
  },
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: { combos: { list: 'combos:list' } },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    className?: string
  }) => {
    const href = params
      ? Object.entries(params).reduce(
          (path, [key, value]) => path.replace(`$${key}`, value),
          to,
        )
      : to
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  },
}))

const bread: ComboComponent = {
  id: 'bread',
  label: 'Wholemeal bread',
  quantity: 70,
  quantityUnit: 'g',
  foodId: 'food-bread',
  food: { baseUnit: 'g', nutritionPer100: { calories: 250 } },
  available: true,
}

const granola: ComboComponent = {
  id: 'granola',
  label: 'Nora’s granola',
  quantity: 1,
  quantityUnit: 'serving',
  recipeId: 'recipe-granola',
  available: false,
}

beforeEach(() => {
  combos.value = undefined
  queried.value = []
})

function render(groupSlug = 'jansen-household') {
  renderWithI18n(<CombosPage nav={groupNutritionNav(groupSlug)} />)
}

test('asks only for the signed-in person’s combos', () => {
  combos.value = []
  render()

  expect(queried.value).toEqual([['combos:list', {}]])
})

test('says what a combo is and how one is made when there are none yet', () => {
  combos.value = []
  render()

  expect(screen.getByText(/no combos yet/i)).toBeDefined()
  expect(screen.getByText(/save as combo/i)).toBeDefined()
  expect(screen.getByRole('link', { name: /diary/i })).toHaveAttribute(
    'href',
    '/g/jansen-household/nutrition',
  )
})

test('lists what each saved combo holds', () => {
  combos.value = [
    { _id: 'combo1', name: 'Usual breakfast', order: 0, components: [bread] },
    { _id: 'combo2', name: 'Work lunch', order: 1, components: [bread, bread] },
  ]
  render()

  expect(screen.getByText('Usual breakfast')).toBeDefined()
  expect(screen.getByText('Work lunch')).toBeDefined()
  expect(screen.getByText('1 item')).toBeDefined()
  expect(screen.getByText('2 items')).toBeDefined()
  expect(screen.getAllByText('Wholemeal bread').length).toBe(3)
  expect(screen.queryByText(/no combos yet/i)).toBeNull()
})

test('a component nobody can reach any more still shows, and says so', () => {
  combos.value = [
    {
      _id: 'combo1',
      name: 'Usual breakfast',
      order: 0,
      components: [bread, granola],
    },
  ]
  render()

  expect(screen.getByText('Nora’s granola')).toBeDefined()
  expect(screen.getByText('Not available any more')).toBeDefined()
})

test('keeps the Group that was open in the way back to the diary', () => {
  combos.value = []
  render('wine-club')

  expect(screen.getByRole('link', { name: /diary/i })).toHaveAttribute(
    'href',
    '/g/wine-club/nutrition',
  )
})
