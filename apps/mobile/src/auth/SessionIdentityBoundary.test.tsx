// @vitest-environment jsdom
import { act, Component, type ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { mount } from '../testing/dom'
import {
  SessionIdentityBoundary,
  SessionIdentityError,
} from './SessionIdentityBoundary'

const query = { fails: true }

function Identity() {
  if (query.fails) throw new SessionIdentityError(new Error('Server Error'))
  return <p>signed-in tree</p>
}

function Broken(): ReactNode {
  throw new Error('a screen bug')
}

/** Stands in for Expo Router's root boundary. */
class Outer extends Component<{ children: ReactNode }, { caught?: string }> {
  state: { caught?: string } = {}
  static getDerivedStateFromError(error: Error) {
    return { caught: error.message }
  }
  render() {
    return this.state.caught ? (
      <p>outer: {this.state.caught}</p>
    ) : (
      this.props.children
    )
  }
}

function fallback(retry: () => void) {
  return (
    <button type="button" onClick={retry}>
      Try again
    </button>
  )
}

describe('SessionIdentityBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    query.fails = true
  })

  test('replaces the tree with the recovery screen when users.me fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = mount(
      <SessionIdentityBoundary fallback={fallback}>
        <Identity />
      </SessionIdentityBoundary>,
    )
    expect(container.textContent).toBe('Try again')
  })

  test('retry asks for authentication again and remounts the tree', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onRetry = vi.fn()
    const { container } = mount(
      <SessionIdentityBoundary fallback={fallback} onRetry={onRetry}>
        <Identity />
      </SessionIdentityBoundary>,
    )
    query.fails = false
    act(() => container.querySelector('button')?.click())
    expect(onRetry).toHaveBeenCalledOnce()
    expect(container.textContent).toBe('signed-in tree')
  })

  test('leaves any other error to the boundary above, rather than calling it a session problem', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = mount(
      <Outer>
        <SessionIdentityBoundary fallback={fallback}>
          <Broken />
        </SessionIdentityBoundary>
      </Outer>,
    )
    expect(container.textContent).toBe('outer: a screen bug')
  })
})
