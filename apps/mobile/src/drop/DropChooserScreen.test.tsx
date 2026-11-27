// @vitest-environment jsdom
/**
 * The Drop chooser's destination list and group sheet announce their options
 * through `radioProps` on iOS and Android (APP-697).
 */
import { noteRefusal } from '@gather/core/refusals'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import type { Id } from '../convex/api'
import { en } from '../i18n/messages/en'
import { mount, settle } from '../testing/dom'
import { DropChooserScreen } from './DropChooserScreen'
import { DropGroupSheet } from './DropGroupSheet'

const state = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  hasDrop: true,
  params: {} as { url?: string; text?: string },
  offered: [] as unknown[],
  dismissedTo: [] as unknown[],
  pushed: [] as unknown[][],
  commit: async (): Promise<unknown> => ({ ok: true, href: '/home' }),
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  type Props = Record<string, unknown> & { children?: ReactNode }
  const dom =
    (tag: string) =>
    ({
      children,
      testID,
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      accessibilityValue,
      onPress,
      disabled,
    }: Props) => {
      const a11yState = accessibilityState as
        | { selected?: boolean; checked?: boolean; disabled?: boolean }
        | undefined
      const a11yValue = accessibilityValue as { text?: string } | undefined
      return React.createElement(
        tag,
        {
          'data-testid': testID as string | undefined,
          'aria-label': accessibilityLabel as string | undefined,
          role: accessibilityRole as string | undefined,
          'aria-selected': a11yState?.selected,
          'aria-checked': a11yState?.checked,
          'aria-valuetext': a11yValue?.text,
          disabled: Boolean(disabled),
          onClick: onPress as (() => void) | undefined,
        },
        typeof children === 'function'
          ? (children as (s: { pressed: boolean }) => ReactNode)({
              pressed: false,
            })
          : children,
      )
    }
  return {
    Platform: {
      get OS() {
        return state.os
      },
    },
    ActivityIndicator: () => null,
    View: dom('div'),
    ScrollView: ({
      children,
      contentInsetAdjustmentBehavior,
    }: Props) =>
      React.createElement(
        'div',
        {
          'data-scroll': 'true',
          'data-inset': contentInsetAdjustmentBehavior as string | undefined,
        },
        children,
      ),
    Text: dom('span'),
    Pressable: dom('button'),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('expo-image', () => ({ Image: () => null }))
vi.mock('expo-router', () => ({
  Stack: Object.assign(() => null, { Screen: () => null }),
  useLocalSearchParams: () => state.params,
  useRouter: () => ({
    push: (...args: unknown[]) => state.pushed.push(args),
    dismissTo: (href: unknown) => state.dismissedTo.push(href),
  }),
}))
vi.mock('../components/NativeSheet', () => ({
  NativeSheet: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
}))
vi.mock('../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../group/GroupProvider', () => ({
  useGroup: () => ({
    group: { _id: 'g1', name: 'Home' },
    groups: [
      { _id: 'g1', name: 'Home' },
      { _id: 'g2', name: 'Cabin' },
    ],
  }),
  useOpenInGroup: () => (_group: unknown, go: () => void) => go(),
}))
vi.mock('../i18n', async () => {
  const { en: messages } = await import('../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return { fmt, useI18n: () => ({ t: messages, locale: 'en' }) }
})
vi.mock('../modules/buildModules', () => ({ moduleShown: () => true }))
vi.mock('../theme/icons', () => ({
  MODULE_ICONS: new Proxy({}, { get: () => () => null }),
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../theme/tokens', () => ({
  RADIUS: new Proxy({}, { get: () => 8 }),
  SIZE: new Proxy({}, { get: () => 44 }),
  TYPE: new Proxy({}, { get: () => ({}) }),
  useTokens: () =>
    new Proxy(
      {},
      {
        get: (_, key) =>
          key === 'tintOf'
            ? () => ({ fill: 'fill', on: 'on', text: 'text', wash: 'wash' })
            : String(key),
      },
    ),
}))
vi.mock('./DropProvider', () => ({
  useDrop: () => ({
    pending: state.hasDrop
      ? {
          drop: {
            kind: 'url' as const,
            url: 'https://example.com/recipe',
            host: 'example.com',
            title: 'Pasta',
          },
        }
      : null,
    offer: (drop: unknown) => state.offered.push(drop),
    clear: () => {},
  }),
}))
vi.mock('./useDropCommit', () => ({
  useDropCommit: () => () => state.commit(),
}))

beforeEach(() => {
  state.os = 'ios'
  state.hasDrop = true
  state.params = {}
  state.offered = []
  state.dismissedTo = []
  state.pushed = []
})

afterEach(() => {
  state.os = 'ios'
  state.hasDrop = true
  state.params = {}
  state.offered = []
  state.dismissedTo = []
})

test('without a Drop it goes back to the tabs, and stacks no second one (APP-775)', () => {
  state.hasDrop = false
  state.dismissedTo = []
  mount(createElement(DropChooserScreen)).unmount()
  expect(state.dismissedTo).toEqual(['/home'])
})

test('a harness drop link replaces an already pending Drop, and a second one replaces it too (APP-840)', () => {
  state.hasDrop = true
  state.params = { text: 'Buy stroopwafels' }
  const view = mount(createElement(DropChooserScreen))
  expect(state.offered).toEqual([{ kind: 'text', text: 'Buy stroopwafels' }])
  expect(state.dismissedTo).toEqual([])

  state.params = { text: 'Buy milk' }
  view.rerender(createElement(DropChooserScreen))
  expect(state.offered).toEqual([
    { kind: 'text', text: 'Buy stroopwafels' },
    { kind: 'text', text: 'Buy milk' },
  ])
  view.unmount()
})

test('a harness drop link dismisses once cleared without re-offering the same seed (APP-840)', () => {
  state.hasDrop = false
  state.params = { text: 'Buy stroopwafels' }
  const view = mount(createElement(DropChooserScreen))
  expect(state.offered).toEqual([{ kind: 'text', text: 'Buy stroopwafels' }])
  expect(state.dismissedTo).toEqual([])

  // Re-render while still waiting for offer() to commit does not dismiss.
  view.rerender(createElement(DropChooserScreen))
  expect(state.offered).toHaveLength(1)
  expect(state.dismissedTo).toEqual([])

  // Once delivered and later cleared, the chooser dismisses without re-offering.
  state.hasDrop = true
  view.rerender(createElement(DropChooserScreen))
  state.hasDrop = false
  view.rerender(createElement(DropChooserScreen))
  expect(state.offered).toHaveLength(1)
  expect(state.dismissedTo).toEqual(['/home'])
  view.unmount()
})

test('DropChooserScreen keeps an automatically inset ScrollView both with and without a drop', () => {
  const populated = mount(createElement(DropChooserScreen))
  expect(
    populated.container.querySelector('[data-scroll="true"]')?.getAttribute('data-inset'),
  ).toBe('automatic')
  populated.unmount()

  state.hasDrop = false
  const empty = mount(createElement(DropChooserScreen))
  expect(
    empty.container.querySelector('[data-scroll="true"]')?.getAttribute('data-inset'),
  ).toBe('automatic')
  empty.unmount()
})

for (const os of ['ios', 'android'] as const) {
  test(`DropChooserScreen target choices announce as radios on ${os}`, () => {
    state.os = os
    const view = mount(createElement(DropChooserScreen))
    const group = view.container.querySelector('[role="radiogroup"]')
    expect(group).not.toBeNull()
    const options = Array.from(group?.querySelectorAll('button') ?? [])
    expect(options.length).toBeGreaterThan(1)

    if (os === 'ios') {
      expect(options.every((el) => el.getAttribute('role') === 'button')).toBe(true)
      expect(
        options.every(
          (el) => el.getAttribute('aria-valuetext') === en.a11y.radioButton,
        ),
      ).toBe(true)
      expect(options[0]?.getAttribute('aria-selected')).toBe('true')
      expect(options[1]?.getAttribute('aria-selected')).toBe('false')
    } else {
      expect(options.every((el) => el.getAttribute('role') === 'radio')).toBe(true)
      expect(options[0]?.getAttribute('aria-checked')).toBe('true')
      expect(options[1]?.getAttribute('aria-checked')).toBe('false')
    }

    view.unmount()
  })

  test(`DropGroupSheet group choices announce as radios on ${os}`, () => {
    state.os = os
    const view = mount(
      createElement(DropGroupSheet, {
        selected: 'g2' as Id<'groups'>,
        onSelect: () => {},
        onClose: () => {},
      }),
    )
    const buttons = Array.from(view.container.querySelectorAll('button'))
    expect(buttons).toHaveLength(2)

    if (os === 'ios') {
      expect(buttons[0]?.getAttribute('role')).toBe('button')
      expect(buttons[0]?.getAttribute('aria-selected')).toBe('false')
      expect(buttons[0]?.getAttribute('aria-valuetext')).toBe(en.a11y.radioButton)
      expect(buttons[1]?.getAttribute('role')).toBe('button')
      expect(buttons[1]?.getAttribute('aria-selected')).toBe('true')
      expect(buttons[1]?.getAttribute('aria-valuetext')).toBe(en.a11y.radioButton)
    } else {
      expect(buttons[0]?.getAttribute('role')).toBe('radio')
      expect(buttons[0]?.getAttribute('aria-checked')).toBe('false')
      expect(buttons[1]?.getAttribute('role')).toBe('radio')
      expect(buttons[1]?.getAttribute('aria-checked')).toBe('true')
    }

    view.unmount()
  })
}

test.each([
  ['a note with no room', { data: noteRefusal('too-long') }, en.notes.refusals['notes:too-long']],
  ['any other failure', new Error('offline'), en.drop.failed],
])('%s is said, with the Drop still there (APP-805)', async (_, error, sentence) => {
  const before = state.commit
  state.commit = () => Promise.reject(error)
  const view = mount(createElement(DropChooserScreen))
  const save = [...view.container.querySelectorAll('button')].find((button) =>
    [en.common.actions.save, en.drop.continue].includes(button.textContent ?? ''),
  )
  save?.click()
  await settle()
  expect(view.container.textContent).toContain(sentence)
  expect(view.container.textContent).toContain('Pasta')
  view.unmount()
  state.commit = before
})

test('a saved Drop opens its destination over its tab root, so reselecting the tab pops to it (APP-963)', async () => {
  const before = state.commit
  state.commit = async () => ({ ok: true, href: '/all/recipes/import?link=x' })
  const view = mount(createElement(DropChooserScreen))
  const save = [...view.container.querySelectorAll('button')].find((button) =>
    [en.common.actions.save, en.drop.continue].includes(button.textContent ?? ''),
  )
  save?.click()
  await settle()
  expect(state.pushed).toEqual([
    ['/all/recipes/import?link=x', { withAnchor: true }],
  ])
  view.unmount()
  state.commit = before
})
