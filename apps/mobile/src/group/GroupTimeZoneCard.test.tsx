// @vitest-environment jsdom
/** The Group's time zone on the phone (APP-475): who may set it, and to what. */
import { act, createElement, type ReactNode } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { mount, settle } from '../testing/dom'
import { GroupTimeZoneCard } from './GroupTimeZoneCard'

const state = vi.hoisted(() => ({
  timeZone: undefined as string | undefined,
  role: 'admin' as 'admin' | 'member',
  calls: [] as unknown[],
  fails: null as unknown,
}))
vi.mock('react-native', () => {
  const el =
    (tag: string) =>
    ({ children, testID }: { children?: ReactNode; testID?: string }) =>
      createElement(tag, { 'data-testid': testID }, children)
  return {
    StyleSheet: { create: (s: unknown) => s },
    Text: el('span'),
    View: el('div'),
  }
})
vi.mock('convex/react', () => ({
  useMutation: () => async (args: unknown) => {
    state.calls.push(args)
    if (state.fails) throw state.fails
  },
}))
vi.mock('../convex/api', () => ({
  api: { groups: { setTimeZone: '' } },
}))
vi.mock('./GroupProvider', () => ({
  useGroup: () => ({
    group: { _id: 'g', timeZone: state.timeZone, role: state.role },
  }),
}))
vi.mock('./TimeZoneSheet', () => ({
  TimeZoneSheet: ({ onChoose }: { onChoose: (zone: string) => void }) =>
    createElement('button', {
      type: 'button',
      'data-testid': 'sheet',
      onClick: () => onChoose('America/New_York'),
    }),
}))
vi.mock('@gather/core/time-zones', async (load) => ({
  ...(await load<typeof import('@gather/core/time-zones')>()),
  deviceTimeZone: () => 'Europe/Amsterdam',
}))
vi.mock('../i18n', async () => {
  const { en } = await import('../i18n/messages/en')
  const { fmt } = await import('@gather/core/i18n')
  return { useI18n: () => ({ t: en, locale: 'en' }), fmt }
})
vi.mock('../feedback/haptics', () => ({
  haptics: { itemSaved: () => {}, actionFailed: () => {} },
}))
vi.mock('../theme/tokens', () => ({
  RADIUS: {},
  TYPE: {},
  useTokens: () => ({}),
}))
vi.mock('../components/AuthError', () => ({
  AuthError: ({ message }: { message: string | null }) => message,
}))
vi.mock('../ui/button', () => ({
  Button: (props: { label: string; testID: string; onPress: () => void }) =>
    createElement(
      'button',
      { type: 'button', 'data-testid': props.testID, onClick: props.onPress },
      props.label,
    ),
}))

const find = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-testid="${id}"]`)

beforeEach(() => {
  Object.assign(state, { timeZone: undefined, role: 'admin', calls: [], fails: null })
})

test("unset: shows the phone's zone, and an admin can use it", async () => {
  const { container } = mount(createElement(GroupTimeZoneCard))
  expect(find(container, 'group-time-zone')?.textContent).toContain('Amsterdam, Central European Time')
  expect(find(container, 'clear-group-time-zone')).toBeNull()
  find(container, 'use-device-time-zone')?.click()
  await settle()
  expect(state.calls).toEqual([{ groupId: 'g', timeZone: 'Europe/Amsterdam' }])
})

test('set to another zone: an admin can clear it', async () => {
  state.timeZone = 'Asia/Tokyo'
  const { container } = mount(createElement(GroupTimeZoneCard))
  expect(find(container, 'group-time-zone')?.textContent).toBe('Tokyo, Japan Standard Time')
  expect(find(container, 'use-device-time-zone')).not.toBeNull()
  find(container, 'clear-group-time-zone')?.click()
  await settle()
  expect(state.calls).toEqual([{ groupId: 'g', timeZone: null }])
})

test('a plain member reads it and is told who may change it', () => {
  state.role = 'member'
  const { container } = mount(createElement(GroupTimeZoneCard))
  expect(container.querySelector('button')).toBeNull()
  expect(container.textContent).toContain('Only an admin')
})

test('an admin picks any zone, and the list closes', async () => {
  const { container } = mount(createElement(GroupTimeZoneCard))
  act(() => find(container, 'choose-group-time-zone')?.click())
  act(() => find(container, 'sheet')?.click())
  await settle()
  expect(state.calls).toEqual([{ groupId: 'g', timeZone: 'America/New_York' }])
  expect(find(container, 'sheet')).toBeNull()
})

test.each([
  [new Error('offline'), 'Could not change the time zone.'],
  [
    { data: { kind: 'groupTimeZone:admin-only' } },
    'Only an admin of this group can change its time zone.',
  ],
  [
    { data: { kind: 'groupTimeZone:unknown-zone' } },
    'Gather does not know the time zone of Amsterdam yet.',
  ],
  [
    { data: { kind: 'groups:not-a-member', message: 'x' } },
    'You are not a member of this group.',
  ],
])('a refused write says why (%#)', async (error, sentence) => {
  state.fails = error
  const { container } = mount(createElement(GroupTimeZoneCard))
  find(container, 'use-device-time-zone')?.click()
  await settle()
  expect(container.textContent).toContain(sentence)
})
