import { afterEach, expect, it, vi } from 'vitest'
import { reportError, setErrorSink } from './report'

afterEach(() => setErrorSink(undefined))

it('is a no-op without a sink', () => {
  expect(() => reportError(new Error('x'))).not.toThrow()
})

it('reports each error object once', () => {
  const sink = vi.fn()
  setErrorSink(sink)
  const error = new Error('boom')
  reportError(error)
  reportError(error)
  expect(sink).toHaveBeenCalledTimes(1)
  expect(sink).toHaveBeenCalledWith(error)
})

it('wraps non-Error values and survives a throwing sink', () => {
  const sink = vi.fn(() => {
    throw new Error('sink down')
  })
  setErrorSink(sink)
  expect(() => reportError('a string with a secret')).not.toThrow()
  expect(sink).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Non-Error value thrown' }),
  )
})
