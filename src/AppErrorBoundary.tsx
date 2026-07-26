import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Last-resort, app-wide safety net. Without this, any uncaught error
 * anywhere in the tree unmounts the whole app and leaves a blank white
 * page with no way back short of the user knowing to reload.
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[AppErrorBoundary] Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif", background: '#f9fafb', padding: 24,
        }}>
          <div style={{
            maxWidth: 380, width: '100%', background: '#fff', border: '1.5px solid #e5e7eb',
            borderRadius: 16, padding: '32px 28px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Something went wrong</p>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.6 }}>
              This page ran into an unexpected error. Reloading usually fixes it.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                all: 'unset', cursor: 'pointer', padding: '10px 24px', borderRadius: 10,
                background: 'linear-gradient(135deg, #e9520e, #f2884d)', color: '#fff',
                fontSize: 14, fontWeight: 700,
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
