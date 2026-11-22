// @vitest-environment jsdom
/**
 * The empty Energy Module (APP-492): its one step opens the address form in
 * place, and Continue sends what the person chose. With an address, the wash
 * names it. React Native is mocked down to plain elements, as in the loyalty
 * card list's test.
 */
import { createElement, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../../testing/dom'
import { EnergyScreen } from './energy-screen'

const state = vi.hoisted(() => ({
  overview: null as unknown,
  houses: [] as { _id: string; name: string }[],
  creates: [] as unknown[],
  refuse: null as null | { kind: string },
  wash: null as unknown,
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const h = React.createElement
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({ children, testID, accessibilityLabel }: Props) =>
      h(
        tag,
        {
          'data-testid': testID as string | undefined,
          'aria-label': accessibilityLabel as string | undefined,
        },
        children,
      )
  const Pressable = ({ children, testID, onPress, accessibilityState }: Props) =>
    h(
      'button',
      {
        'data-testid': testID as string | undefined,
        'aria-checked': (accessibilityState as { checked?: boolean } | undefined)
          ?.checked,
        onClick: () => (onPress as (() => void) | undefined)?.(),
      },
      typeof children === 'function' ? null : children,
    )
  return {
    View: dom('div'),
    Text: dom('span'),
    ScrollView: dom('div'),
    Pressable,
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
vi.mock('expo-router', () => {
  const Stack = () => null
  Stack.Screen = () => null
  return { Stack }
})
vi.mock('convex/react', () => ({
  useMutation: () => async (args: unknown) => {
    state.creates.push(args)
    if (state.refuse) throw Object.assign(new Error('refused'), { data: state.refuse })
    return 'site1'
  },
}))
vi.mock('../../convex/api', () => ({
  api: {
    energy: { overview: 'energy:overview', createSite: 'energy:createSite' },
    houses: { list: 'houses:list' },
  },
}))
vi.mock('../../convex/queries', () => ({
  useQuery: (name: string) =>
    name === 'energy:overview' ? state.overview : state.houses,
}))
vi.mock('../../group/GroupProvider', () => ({
  useGroup: () => ({ group: { slug: 'home', name: 'Home' } }),
}))
vi.mock('../../i18n', async () => {
  const { en } = await import('../../i18n/messages/en')
  return { useI18n: () => ({ t: en, locale: 'en' }) }
})
vi.mock('../../theme/icons', () => ({
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  SPACE: [0, 4, 8, 12, 16, 20],
  RADIUS: { card: 12 },
  TYPE: {},
  useTokens: () => ({}),
}))
vi.mock('../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../components/LoadingSkeleton', () => ({
  LoadingSkeleton: () => null,
}))
vi.mock('../../ui/button', () => ({
  Button: ({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) =>
    createElement(
      'button',
      { type: 'button', 'data-testid': testID, onClick: onPress },
      label,
    ),
}))
vi.mock('../../ui/card', () => ({
  Card: ({ children }: { children: ReactNode }) =>
    createElement('section', null, children),
}))
vi.mock('../../ui/section-label', () => ({
  SectionLabel: ({ children }: { children: ReactNode }) =>
    createElement('h4', null, children),
}))
vi.mock('../../ui/field', () => ({
  Field: ({
    value,
    onChangeText,
    testID,
  }: {
    value: string
    onChangeText: (text: string) => void
    testID: string
  }) =>
    createElement('input', {
      'data-testid': testID,
      value,
      onChange: (event: { target: { value: string } }) =>
        onChangeText(event.target.value),
    }),
}))
vi.mock('../../ui/module-tile', () => ({
  moduleTile: () => ({ group: 'home', glyph: {} }),
}))
vi.mock('../../ui/screen-header', () => ({ washScreenOptions: () => ({}) }))
vi.mock('../../ui/wash-header', () => ({
  WashHeader: ({ summary }: { summary: unknown }) => {
    state.wash = summary
    return null
  },
}))
vi.mock('@expo/ui/community/menu', () => ({
  MenuView: ({
    testID,
    actions,
    onPressAction,
  }: {
    testID: string
    actions: { id: string }[]
    onPressAction: (event: { nativeEvent: { event: string } }) => void
  }) =>
    createElement(
      'div',
      { 'data-testid': testID },
      actions.map((action) =>
        createElement('button', {
          type: 'button',
          key: action.id || 'none',
          'data-testid': `${testID}-${action.id || 'none'}`,
          onClick: () => onPressAction({ nativeEvent: { event: action.id } }),
        }),
      ),
    ),
}))

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`)

beforeEach(() => {
  state.overview = null
  state.houses = []
  state.creates = []
  state.refuse = null
  state.wash = null
})

test('empty, the wash says there is no address and the step opens the form', async () => {
  const view = mount(createElement(EnergyScreen))
  expect(state.wash).toEqual({
    count: 'No address yet',
    sub: 'Usage, costs and prices per hour',
  })
  expect(byTestId('energy-name')).toBeNull()
  byTestId('energy-add-first')?.click()
  await settle()
  expect((byTestId('energy-name') as HTMLInputElement).value).toBe('Home')
  expect(byTestId('energy-source-homeAssistant')?.getAttribute('aria-checked')).toBe(
    'true',
  )
  view.unmount()
})

test('Continue sends meter readings and the chosen House', async () => {
  state.houses = [{ _id: 'house1', name: 'Dorpsstraat 1' }]
  const view = mount(createElement(EnergyScreen))
  byTestId('energy-add-first')?.click()
  await settle()
  byTestId('energy-house-menu-house1')?.click()
  byTestId('energy-source-manual')?.click()
  await settle()
  byTestId('energy-submit')?.click()
  await settle()
  expect(state.creates).toEqual([
    {
      groupSlug: 'home',
      name: 'Home',
      houseId: 'house1',
      source: { kind: 'manual', label: 'Meter readings' },
    },
  ])
  view.unmount()
})

test('a refusal is said in words', async () => {
  state.refuse = { kind: 'energy:houseNotFound' }
  const view = mount(createElement(EnergyScreen))
  byTestId('energy-add-first')?.click()
  await settle()
  byTestId('energy-submit')?.click()
  await settle()
  expect(document.body.textContent).toContain(
    'That house is not in this Group any more.',
  )
  view.unmount()
})

test('with an address, the wash names it and its source', () => {
  state.overview = {
    site: { _id: 's1', name: 'Thuis' },
    sources: [{ _id: 'src1', kind: 'manual', label: 'Meterstanden', status: 'ok' }],
  }
  const view = mount(createElement(EnergyScreen))
  expect(state.wash).toEqual({ count: 'Thuis', sub: 'Meterstanden' })
  expect(document.body.textContent).toContain('Coming next')
  view.unmount()
})
