// @vitest-environment jsdom
/**
 * Tasks' single-choice pickers announce their options through `radioProps`
 * (APP-697): button + selected + localized "radio button" value on iOS, real
 * radio + checked on Android.
 */
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { en } from '../../i18n/messages/en'
import { mount } from '../../testing/dom'
import { GroceryListsSheet } from './GroceryListsSheet'
import { ColorSwatches, IconChoices } from './listFace'
import { NewListSheet } from './NewListSheet'
import { MoveToSectionSheet } from './sections'
import { MoveToListSheet, PrioritySheet } from './sheets'
import type { Task } from './types'

const state = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  lists: [
    {
      _id: 'l1',
      name: 'Inbox',
      provider: 'local' as const,
      writable: true,
      order: 0,
      sections: [
        { id: 's1', name: 'Morning' },
        { id: 's2', name: 'Evening' },
      ],
    },
    {
      _id: 'l2',
      name: 'Notion',
      provider: 'notion' as const,
      writable: false,
      order: 1,
      sections: [],
    },
  ],
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
          'aria-disabled': a11yState?.disabled,
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
    View: dom('div'),
    ScrollView: dom('div'),
    Text: dom('span'),
    Pressable: dom('button'),
    TextInput: dom('input'),
    StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  }
})
vi.mock('@expo/ui/community/menu', () => ({ MenuView: () => null }))
vi.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }))
vi.mock('../../components/MonthGridView', () => ({
  MonthGridView: () => null,
  WeekdayStrip: () => null,
}))
vi.mock('../../components/NativeContextMenu', () => ({
  NativeContextMenu: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../../components/NativeSheet', () => ({
  NativeSheet: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
}))
vi.mock('../../feedback/confirmDestructive', () => ({
  confirmDestructive: () => {},
}))
vi.mock('../../feedback/haptics', () => ({
  haptics: new Proxy({}, { get: () => () => {} }),
}))
vi.mock('../../group/GroupProvider', () => ({ useGroup: () => ({ group: {} }) }))
vi.mock('../../i18n', async () => {
  const { en: messages } = await import('../../i18n/messages/en')
  const { fmt, plural } = await import('@gather/core/i18n')
  return { fmt, plural, useI18n: () => ({ t: messages, locale: 'en' }) }
})
vi.mock('../../theme/icons', () => ({
  MODULE_ICONS: new Proxy({}, { get: () => () => null }),
  UI_ICONS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('../../theme/tokens', () => ({
  RADIUS: new Proxy({}, { get: () => 8 }),
  SIZE: new Proxy({}, { get: () => 44 }),
  SPACE: [0, 4, 8, 12, 16, 20, 24],
  TABULAR: {},
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
vi.mock('../../ui/inset-list', () => ({
  InsetList: ({ children }: { children: ReactNode }) =>
    createElement('div', null, children),
  useInsetSeparator: () => ({}),
}))
vi.mock('../../ui/module-tile', () => ({
  ModuleTile: () => null,
  TILE_METRICS: new Proxy({}, { get: () => ({ box: 32, radius: 8, glyph: 16 }) }),
}))
vi.mock('../../ui/section-label', () => ({
  SectionLabel: ({ children }: { children: ReactNode }) =>
    createElement('span', null, children),
}))
vi.mock('../../ui/sheet-drafts', () => ({
  useSheetDraft: () => ({ kept: undefined, track: () => {}, finish: () => {} }),
}))
vi.mock('./icons', () => ({
  TASK_ICONS: new Proxy({}, { get: () => () => null }),
  TASK_LIST_GLYPHS: new Proxy({}, { get: () => () => null }),
}))
vi.mock('./writeFailed', () => ({ useWriteFailed: () => () => {} }))
vi.mock('./store', () => ({
  useGroupLabels: () => [],
  useTaskActions: () => ({
    createList: async () => 'new-id',
    setPriority: async () => {},
    moveTask: async () => {},
    setTaskSection: async () => {},
    setListAppearance: async () => {},
  }),
  useTaskLists: () => state.lists,
  useTasksOf: () => ({ tasks: [] }),
}))

const sampleTask: Task = {
  id: 't1',
  listId: 'l1',
  title: 'Milk',
  done: false,
  order: 0,
  priority: 2,
  sectionId: 's1',
  labels: [],
}

function expectRadio(
  element: Element | null,
  selected: boolean,
  platform: 'ios' | 'android',
) {
  expect(element).not.toBeNull()
  if (platform === 'ios') {
    expect(element?.getAttribute('role')).toBe('button')
    expect(element?.getAttribute('aria-selected')).toBe(String(selected))
    expect(element?.getAttribute('aria-valuetext')).toBe(en.a11y.radioButton)
  } else {
    expect(element?.getAttribute('role')).toBe('radio')
    expect(element?.getAttribute('aria-checked')).toBe(String(selected))
  }
}

beforeEach(() => {
  state.os = 'ios'
})

afterEach(() => {
  state.os = 'ios'
})

for (const os of ['ios', 'android'] as const) {
  test(`ColorSwatches and IconChoices announce as radios on ${os}`, () => {
    state.os = os
    const colors = mount(
      createElement(ColorSwatches, { value: 'kitchen', onChange: () => {} }),
    )
    expectRadio(
      colors.container.querySelector('[data-testid="list-color-kitchen"]'),
      true,
      os,
    )
    expectRadio(
      colors.container.querySelector('[data-testid="list-color-home"]'),
      false,
      os,
    )
    colors.unmount()

    const icons = mount(
      createElement(IconChoices, {
        icons: ['list', 'cart'],
        value: 'cart',
        onChange: () => {},
      }),
    )
    expectRadio(
      icons.container.querySelector('[data-testid="list-icon-cart"]'),
      true,
      os,
    )
    expectRadio(
      icons.container.querySelector('[data-testid="list-icon-list"]'),
      false,
      os,
    )
    icons.unmount()
  })

  test(`NewListSheet kinds announce as radios on ${os}`, () => {
    state.os = os
    const view = mount(
      createElement(NewListSheet, {
        initialKind: 'groceries',
        onCreated: () => {},
        onClose: () => {},
      }),
    )
    expectRadio(
      view.container.querySelector('[data-testid="new-list-kind-groceries"]'),
      true,
      os,
    )
    expectRadio(
      view.container.querySelector('[data-testid="new-list-kind-plain"]'),
      false,
      os,
    )
    view.unmount()
  })

  test(`GroceryListsSheet rows announce as radios on ${os}`, () => {
    state.os = os
    const groceryLists = [
      { _id: 'g1', name: 'Albert Heijn', provider: 'local' as const },
      { _id: 'g2', name: 'Jumbo', provider: 'local' as const },
    ] as unknown as Parameters<typeof GroceryListsSheet>[0]['lists']
    const view = mount(
      createElement(GroceryListsSheet, {
        lists: groceryLists,
        selectedId: 'g1',
        onChoose: () => {},
        onAisleOrder: () => {},
        onNewList: () => {},
        onClose: () => {},
      }),
    )
    expectRadio(
      view.container.querySelector('[data-testid="grocery-list-Albert Heijn"]'),
      true,
      os,
    )
    expectRadio(
      view.container.querySelector('[data-testid="grocery-list-Jumbo"]'),
      false,
      os,
    )
    view.unmount()
  })

  test(`PrioritySheet announces priorities and None as radios on ${os}`, () => {
    state.os = os
    const view = mount(
      createElement(PrioritySheet, { task: sampleTask, onClose: () => {} }),
    )
    expectRadio(
      view.container.querySelector('[data-testid="priority-2"]'),
      true,
      os,
    )
    expectRadio(
      view.container.querySelector('[data-testid="priority-1"]'),
      false,
      os,
    )
    expectRadio(
      view.container.querySelector('[data-testid="priority-none"]'),
      false,
      os,
    )
    view.unmount()

    const unset = mount(
      createElement(PrioritySheet, {
        task: { ...sampleTask, priority: undefined },
        onClose: () => {},
      }),
    )
    expectRadio(
      unset.container.querySelector('[data-testid="priority-none"]'),
      true,
      os,
    )
    unset.unmount()
  })

  test(`MoveToListSheet announces lists as radios and keeps disabled on ${os}`, () => {
    state.os = os
    const view = mount(
      createElement(MoveToListSheet, { task: sampleTask, onClose: () => {} }),
    )
    const current = view.container.querySelector('[data-testid="move-l1"]')
    const readonly = view.container.querySelector('[data-testid="move-l2"]')
    expectRadio(current, true, os)
    expect(current?.getAttribute('aria-disabled')).toBe('false')
    expectRadio(readonly, false, os)
    expect(readonly?.getAttribute('aria-disabled')).toBe('true')
    view.unmount()
  })

  test(`MoveToSectionSheet announces sections as radios on ${os}`, () => {
    state.os = os
    const view = mount(
      createElement(MoveToSectionSheet, { task: sampleTask, onClose: () => {} }),
    )
    expectRadio(
      view.container.querySelector('[data-testid="move-section-s1"]'),
      true,
      os,
    )
    expectRadio(
      view.container.querySelector('[data-testid="move-section-none"]'),
      false,
      os,
    )
    view.unmount()
  })
}
