import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error boundary caught:', error, info);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#060b16] px-6 text-center text-slate-100">
          <div className="max-w-md rounded-2xl border border-white/15 bg-[#0a111f] p-6 shadow-2xl">
            <h1 className="font-display text-3xl font-extrabold tracking-wide text-amber-400">
              MATCH INTERRUPTED
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Something went wrong while syncing match data. Reload the page to
              resume play.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="font-display mt-5 rounded-xl bg-amber-400 px-6 py-2.5 text-lg font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-amber-300 cursor-pointer"
            >
              RELOAD MATCH
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
