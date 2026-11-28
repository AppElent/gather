// @vitest-environment jsdom
/**
 * Import from link and New recipe keep the iOS large title collapsing on
 * scroll (APP-963): the form's scroll view is the screen's root, with no
 * keyboard wrapper around it, and it keeps the keyboard off the form itself.
 */
import { act, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { mount, until } from '../../testing/dom'
import { ComposeRecipeScreen } from './ComposeRecipeScreen'

type Props = Record<string, unknown> & { children?: ReactNode }

const state = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  pending: null as unknown,
  calls: [] as string[],
}))

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
  // The import reads a recipe with a title, so Save is enabled.
  useAction: () => async () => ({
    title: 'Pasta',
    ingredients: [],
    steps: [],
    tags: [],
    imageId: null,
    imageUrl: null,
    sourceUrl: null,
  }),
  useMutation: () => async () => 'recipe-1',
}))
vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => state.params,
  useRouter: () => ({
    push: (href: unknown) => state.calls.push(`push ${String(href)}`),
    dismissTo: (href: unknown) =>
      state.calls.push(`dismissTo ${String(href)}`),
  }),
}))
vi.mock('../../convex/api', () => ({
  api: new Proxy({}, { get: () => new Proxy({}, { get: (_, k) => k }) }),
}))
vi.mock('../../convex/queries', () => ({ useQuery: () => false }))
vi.mock('../../drop/DropProvider', () => ({
  useDrop: () => ({
    pending: state.pending,
    clear: () => state.calls.push('clear'),
  }),
}))
vi.mock('../../drop/useBackToChooser', () => ({
  useBackToChooser: () => () => state.calls.push('leaveDrop'),
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
vi.mock('./RecipeFields', async () => {
  const React = await import('react')
  return {
    RecipeFields: () => null,
    SaveRecipeButton: ({
      disabled,
      onPress,
    }: {
      disabled: boolean
      onPress: () => void
    }) =>
      React.createElement('button', {
        'data-testid': 'save',
        disabled,
        onClick: onPress,
      }),
  }
})
vi.mock('./useRecipes', () => ({
  useRecipes: () => ({ groupSlug: 'home', groupName: 'Home' }),
}))

let view: ReturnType<typeof mount> | undefined
beforeEach(() => {
  state.params = {}
  state.pending = null
  state.calls = []
})
afterEach(() => view?.unmount())

// APP-972: the save goes down past the chooser first, so `/home` is the tabs
// under it and Back from the new recipe never finds this form again.
test("a Drop's import save leaves for the chooser before it lands", async () => {
  state.params = { link: 'https://example.com/pasta' }
  state.pending = { drop: { kind: 'url', url: 'https://example.com/pasta' } }
  view = mount(<ComposeRecipeScreen mode="import" />)
  const save = () =>
    view?.container.querySelector<HTMLButtonElement>('[data-testid="save"]')
  await until(() => save()?.disabled === false)

  act(() => save()?.click())
  await until(() => state.calls.length === 4)

  expect(state.calls).toEqual([
    'leaveDrop',
    'clear',
    'dismissTo /home',
    'push /all/recipes',
  ])
})

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
