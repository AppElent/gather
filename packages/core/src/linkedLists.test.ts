import { expect, test, vi } from 'vitest'
import { connectionOf } from './linkedLists'

type Listen = (state: { isWebSocketConnected: boolean }) => void

function client(now?: boolean) {
  const stop = vi.fn()
  let tell: Listen = () => {}
  const connection = connectionOf({
    connectionState: () => ({ isWebSocketConnected: false }),
    subscribeToConnectionState: (listen) => {
      tell = listen
      if (now !== undefined) listen({ isWebSocketConnected: now })
      return stop
    },
  })
  return { connection, stop, tell: (on: boolean) => tell({ isWebSocketConnected: on }) }
}

test('runs once when the connection is back', () => {
  const { connection, stop, tell } = client(false)
  const run = vi.fn()
  connection.whenOnline(run)
  tell(false)
  expect(run).not.toHaveBeenCalled()
  tell(true)
  tell(true)
  expect(run).toHaveBeenCalledTimes(1)
  expect(stop).toHaveBeenCalledTimes(1)
})

test('runs once when told it is back while subscribing (APP-839)', () => {
  const { connection, stop, tell } = client(true)
  const run = vi.fn()
  connection.whenOnline(run)
  tell(true)
  expect(run).toHaveBeenCalledTimes(1)
  expect(stop).toHaveBeenCalledTimes(1)
})
