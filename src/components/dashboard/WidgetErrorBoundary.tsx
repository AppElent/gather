import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  fallback: (retry: () => void) => ReactNode
}

type State = { error: Error | null }

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  retry = () => this.setState({ error: null })

  render() {
    return this.state.error
      ? this.props.fallback(this.retry)
      : this.props.children
  }
}
