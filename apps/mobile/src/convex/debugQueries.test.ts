import { describe, expect, test, vi } from 'vitest'

import {
  debugWebSocketConstructor,
  describeQuerySet,
  loggingWebSocket,
} from './debugQueries'

const querySet = (modifications: unknown[]) =>
  JSON.stringify({
    type: 'ModifyQuerySet',
    baseVersion: 0,
    newVersion: 1,
    modifications,
  })

describe('describeQuerySet', () => {
  test('names an added and a removed subscription by its function', () => {
    const names = new Map<number, string>()
    expect(
      describeQuerySet(
        querySet([
          { type: 'Add', queryId: 0, udfPath: 'users:me', args: [{}] },
          { type: 'Add', queryId: 1, udfPath: 'recipes:list', args: [{}] },
        ]),
        names,
      ),
    ).toEqual(['[convex-query] + users:me', '[convex-query] + recipes:list'])
    expect(
      describeQuerySet(querySet([{ type: 'Remove', queryId: 1 }]), names),
    ).toEqual(['[convex-query] - recipes:list'])
    expect(names).toEqual(new Map([[0, 'users:me']]))
  })

  test('ignores every other message', () => {
    const names = new Map<number, string>()
    expect(
      describeQuerySet(JSON.stringify({ type: 'Connect' }), names),
    ).toEqual([])
    expect(describeQuerySet('not json "ModifyQuerySet"', names)).toEqual([])
    expect(describeQuerySet(new ArrayBuffer(4), names)).toEqual([])
  })
})

describe('loggingWebSocket', () => {
  test('logs what it sends and still sends it', () => {
    const sent: unknown[] = []
    class FakeSocket {
      send(data: unknown) {
        sent.push(data)
      }
    }
    const log = vi.fn()
    const Logging = loggingWebSocket(
      FakeSocket as unknown as typeof WebSocket,
      log,
    )
    const socket = new Logging('wss://example.invalid')
    const message = querySet([
      { type: 'Add', queryId: 0, udfPath: 'users:me', args: [{}] },
    ])
    socket.send(message)
    expect(sent).toEqual([message])
    expect(log).toHaveBeenCalledWith('[convex-query] + users:me')
  })

  test('is off unless asked for', () => {
    expect(debugWebSocketConstructor(false)).toBeUndefined()
  })
})
