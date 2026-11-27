// @vitest-environment jsdom
/**
 * Import from link and New recipe keep the iOS large title collapsing on
 * scroll (APP-963): the form's scroll view is the screen's root, with no
 * keyboard wrapper around it, and it keeps the keyboard off the form itself.
 */
import type { ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../../testing/dom'
import { ComposeRecipeScreen } from './ComposeRecipeScreen'

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
    Pressable: box('Pressable'),
    TextInput: () => h('input'),
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
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), dismissTo: vi.fn() }),
}))
vi.mock('../../convex/api', () => ({
  api: new Proxy({}, { get: () => new Proxy({}, { get: (_, k) => k }) }),
}))
vi.mock('../../convex/queries', () => ({ useQuery: () => false }))
vi.mock('../../drop/DropProvider', () => ({
  useDrop: () => ({ pending: null, clear: vi.fn() }),
}))
vi.mock('../../feedback/haptics', () => ({
  haptics: { actionFailed: vi.fn(), itemSaved: vi.fn() },
}))
vi.mock('../../i18n', async () => {
  const { fmt } = await import('@gather/core/i18n')
  const { en } = await import('../../i18n/messages/en')
  return { fmt, useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../../theme/tokens', () => {
  const any = new Proxy({}, { get: () => ({}) })
  return { RADIUS: any, TYPE: any, useTokens: () => ({}) }
})
vi.mock('../moduleDestination', () => ({ moduleHref: () => '/all/recipes' }))
vi.mock('./RecipeFields', () => ({
  RecipeFields: () => null,
  SaveRecipeButton: () => null,
}))
vi.mock('./useRecipes', () => ({
  useRecipes: () => ({ groupSlug: 'home', groupName: 'Home' }),
}))

let view: ReturnType<typeof mount> | undefined
afterEach(() => view?.unmount())

describe.each(['import', 'new'] as const)('Compose recipe (%s)', (mode) => {
  test('the scroll view is the root and keeps the keyboard off the form', () => {
    view = mount(<ComposeRecipeScreen mode={mode} />)
    const root = view.container.firstElementChild as HTMLElement | null

    expect(root?.dataset.rn).toBe('ScrollView')
    expect(root?.dataset.insetBehavior).toBe('automatic')
    expect(root?.dataset.keyboardInsets).toBe('auto')
    expect(
      view.container.querySelector('[data-rn="KeyboardAvoidingView"]'),
    ).toBeNull()
  })
})
