'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string | null;
};

/** Catches render crashes so the shell stays usable. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Something went wrong.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AppErrorBoundary', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-lg font-medium text-ink">Something went wrong</p>
          <p className="max-w-md text-sm text-slate">
            {this.state.message || 'An unexpected error occurred in this screen.'}
          </p>
          <Button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, message: null });
              window.location.assign('/dashboard');
            }}
          >
            Back to dashboard
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
