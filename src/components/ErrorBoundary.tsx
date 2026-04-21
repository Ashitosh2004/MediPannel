import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Ignore Firebase Firestore internal assertion errors — they're non-fatal
    // internal state machine bugs in the watch stream. Reload to recover.
    const msg = error?.message ?? '';
    if (msg.includes('FIRESTORE') && msg.includes('INTERNAL ASSERTION FAILED')) {
      // Auto-reload after a short delay to recover Firestore watch stream
      setTimeout(() => window.location.reload(), 1500);
      return;
    }
    console.error('Unhandled error:', error);
  }

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message ?? '';
      const isFirestoreError =
        msg.includes('FIRESTORE') && msg.includes('INTERNAL ASSERTION FAILED');

      if (isFirestoreError) {
        return (
          <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="text-center p-8">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">Reconnecting to server...</p>
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h2>
            <p className="text-muted-foreground text-sm mb-4">
              An unexpected error occurred. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
