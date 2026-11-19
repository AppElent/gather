import { expect, test, vi } from 'vitest'

vi.mock('expo-notifications', () => ({}))
vi.mock('convex/react', () => ({ useMutation: () => () => Promise.resolve() }))
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('../../../convex/api', () => ({ api: { tasks: { update: 'update' } } }))
vi.mock('../../../i18n', () => ({ useI18n: () => ({}) }))

const { doneTarget } = await import('./push-task-done')

type Response = Parameters<typeof doneTarget>[0]

function response(actionIdentifier: string, url: unknown): Response {
  return {
    actionIdentifier,
    notification: {
      request: { identifier: 'n1', content: { data: { url } } },
    },
  } as unknown as Response
}

test('Done on a task reminder names the task and its Group', () => {
  expect(doneTarget(response('done', '/g/house/tasks/task/abc123'))).toEqual({
    groupSlug: 'house',
    taskId: 'abc123',
    id: 'n1',
  })
})

test('a tap, an event, or anything else is not a Done', () => {
  const tap = 'expo.modules.notifications.actions.DEFAULT'
  expect(doneTarget(response(tap, '/g/house/tasks/task/abc123'))).toBeNull()
  expect(doneTarget(response('done', '/g/house/calendar/abc123'))).toBeNull()
  expect(doneTarget(response('done', 'https://evil.example/g/x/tasks/task/a'))).toBeNull()
  expect(doneTarget(response('done', undefined))).toBeNull()
})
