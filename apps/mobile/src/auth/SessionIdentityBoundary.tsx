/**
 * Recovery for the one query the signed-in tree cannot do without.
 *
 * `ConvexSessionGate` asks `users.me` who the backend thinks is signed in, and
 * Convex's `useQuery` throws a failed query out of render. Without a boundary
 * that throw takes the whole app down to Expo Router's root error screen, with
 * no way out but killing it. This catches it and offers the two ways out that
 * can work: try again, or sign out.
 *
 * It only catches `SessionIdentityError`. A broken screen deeper in the tree is
 * not a session problem, and telling somebody to sign out over it would be a
 * lie — those rethrow to whatever boundary sits above.
 *
 * Free of React Native on purpose, so the Node suite can render it.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'

/** The identity query failed — as opposed to anything else in the tree. */
export class SessionIdentityError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : 'users.me failed', {
      cause,
    })
    this.name = 'SessionIdentityError'
  }
}

export interface SessionIdentityBoundaryProps {
  children: ReactNode
  /** Drawn in place of the tree; `retry` remounts it, which subscribes to the
   * identity query afresh. */
  fallback: (retry: () => void) => ReactNode
  /** Runs before a retry remounts the tree. */
  onRetry?: () => void
}

interface State {
  error: Error | null
}

export class SessionIdentityBoundary extends Component<
  SessionIdentityBoundaryProps,
  State
> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (error instanceof SessionIdentityError) {
      console.warn('[session] identity query failed', error.cause, info)
    }
  }

  retry = () => {
    this.props.onRetry?.()
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (!(error instanceof SessionIdentityError)) throw error
    return this.props.fallback(this.retry)
  }
}
