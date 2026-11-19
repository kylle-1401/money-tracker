import { Component, type ErrorInfo, type ReactNode } from 'react';
import EmptyState from './EmptyState.tsx';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors (e.g. the on-device database can't open in a private
 * browsing window) and shows a message instead of a blank screen.
 *
 * Class component on purpose: React only supports error boundaries as classes,
 * so this is the one exception to the "function components only" rule.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Logged to the device's own console only; nothing is sent anywhere.
    console.error('App error', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 'calc(var(--safe-top) + 16px) 16px 16px' }}>
          <EmptyState title="Something went wrong">
            Your data is still saved on this device. Try reloading the app.
          </EmptyState>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, minHeight: 44, width: '100%' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
