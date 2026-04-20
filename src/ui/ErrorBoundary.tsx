import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught render error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <div className="max-w-md rounded-lg border border-red-300 bg-red-50 p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-red-800">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-red-700">
              The app hit an unexpected error and had to stop. Your data is still
              saved in the browser. Reload the page and try again; if this keeps
              happening, export a backup from the dashboard and reset all data.
            </p>
            <pre className="mt-3 overflow-auto rounded bg-white/60 p-2 text-xs text-red-900">
              {this.state.error.message}
            </pre>
            <button
              onClick={this.handleReload}
              className="mt-4 inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
