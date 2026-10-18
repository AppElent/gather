import { beforeEach, describe, expect, it, vi } from 'vitest'

const captureException = vi.hoisted(() => vi.fn())
vi.mock('@sentry/react-native', () => ({ captureException }))

import { reportError } from './report'

describe('reportError', () => {
  beforeEach(() => captureException.mockReset())

  it('reports an error once, with its original stack', () => {
    const error = new Error('boom')
    reportError(error)
    reportError(error)
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException).toHaveBeenCalledWith(error)
  })

  it('wraps a non-Error value without its content', () => {
    reportError('jane@example.nl')
    const sent = captureException.mock.calls[0]?.[0] as Error
    expect(sent).toBeInstanceOf(Error)
    expect(sent.message).not.toContain('jane')
  })

  it('never throws into the UI path', () => {
    captureException.mockImplementationOnce(() => {
      throw new Error('sdk down')
    })
    expect(() => reportError(new Error('x'))).not.toThrow()
  })
})
