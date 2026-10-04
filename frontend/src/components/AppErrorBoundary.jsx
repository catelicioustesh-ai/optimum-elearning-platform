import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Uncaught application render error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-panel px-6">
          <section className="max-w-lg rounded-2xl border border-line bg-paper p-8 text-center shadow-sm" role="alert">
            <h1 className="text-xl font-bold text-ink">Something went wrong</h1>
            <p className="mt-2 text-sm text-text-muted">
              This page could not be displayed. Reload the app to try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-coral-dim"
            >
              Reload page
            </button>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}
