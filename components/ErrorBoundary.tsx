'use client'
import React from 'react'

interface Props { children: React.ReactNode; fallback?: React.ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          padding: '32px 24px', textAlign: 'center',
          background: 'rgba(217,83,79,0.06)', border: '1px solid rgba(217,83,79,0.2)',
          borderRadius: 12, margin: '16px 0',
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Something went wrong</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{this.state.error?.message}</div>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600, borderRadius: 8,
              background: 'var(--gold)', color: 'var(--bg)', border: 'none', cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
