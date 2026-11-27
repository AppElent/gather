// @vitest-environment jsdom
/**
 * Edit recipe's large title collapses into the small one as the form scrolls
 * (APP-971): the form's scroll view is the screen's root, with no keyboard
 * wrapper around it, and it keeps the keyboard off the form itself.
 */
import type { ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'
import { EditRecipeScreen } from './EditRecipeScreen'

type Props = Record<string, unknown> & { children?: ReactNode }

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  const box =
    (name: string) =>
    ({ children, ...props }: Props) =>
      h(
        'div',
        {
          'data-rn': name,
          'data-keyboard-insets': props.automaticallyAdjustKeyboardInsets
            ? 'auto'
            : undefined,
          'data-inset-behavior': props.contentInsetAdjustmentBehavior as string,
        },
        children,
      )
  return {
    View: box('View'),
    Text: box('Text'),
    ScrollView: box('ScrollView'),
    KeyboardAvoidingView: box('KeyboardAvoidingView'),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}))
vi.mock('convex/react', () => ({
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
}))
vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ recipeId: 'recipe-1' }),
  useRouter: () => ({ back: vi.fn() }),
}))
vi.mock('../../convex/api', () => ({
  api: new Proxy({}, { get: () => new Proxy({}, { get: (_, k) => k }) }),
}))
vi.mock('../../convex/queries', () => ({
  useQuery: (query: string) =>
    query === 'get'
      ? { _id: 'recipe-1', title: 'Soup', ingredients: [], steps: [] }
      : false,
}))
vi.mock('../../feedback/haptics', () => ({
  haptics: { actionFailed: vi.fn(), itemSaved: vi.fn() },
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  return { useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../../theme/tokens', () => {
  const any = new Proxy({}, { get: () => ({}) })
  return { TYPE: any, useTokens: () => ({}) }
})
vi.mock('../../components/LoadingSkeleton', () => ({
  LoadingSkeleton: () => null,
}))
vi.mock('../kitchen/add-to-groceries/line-cache', () => ({
  clearCachedLines: vi.fn(),
}))
vi.mock('./RecipeFields', () => ({
  RecipeFields: () => null,
  SaveRecipeButton: () => null,
}))
vi.mock('./recipeForm', () => ({
  recipeFormFromRecipe: () => ({ title: 'Soup' }),
  recipeFormProblem: () => null,
  recipeFieldsFrom: () => ({}),
}))
vi.mock('./useRecipes', () => ({
  useRecipes: () => ({ groupSlug: 'home' }),
}))

let view: ReturnType<typeof mount> | undefined
afterEach(() => view?.unmount())

describe('Edit recipe', () => {
  test('the scroll view is the root and keeps the keyboard off the form', () => {
    view = mount(<EditRecipeScreen />)
    const root = view.container.firstElementChild as HTMLElement | null

    expect(root?.dataset.rn).toBe('ScrollView')
    expect(root?.dataset.insetBehavior).toBe('automatic')
    expect(root?.dataset.keyboardInsets).toBe('auto')
    expect(
      view.container.querySelector('[data-rn="KeyboardAvoidingView"]'),
    ).toBeNull()
  })
})
