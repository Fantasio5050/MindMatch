import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback: ReactNode
}

interface State {
  crashed: boolean
}

/** Catches errors thrown while mounting a 3D scene (unsupported/disabled WebGL, driver context
 * creation failure — real conditions seen on some Smart TV browsers) so the whole TV screen
 * doesn't go blank. The HUD overlays drawn on top of the scene already carry every piece of game
 * info, so falling back to `fallback` alone keeps the party fully playable. */
export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('3D scene failed, falling back to 2D:', error)
  }

  render() {
    return this.state.crashed ? this.props.fallback : this.props.children
  }
}
