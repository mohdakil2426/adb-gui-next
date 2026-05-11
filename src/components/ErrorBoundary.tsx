import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { debugLog } from '@/lib/debug';

interface Props {
  children: ReactNode;
  /** Shown in the error message, e.g. "Dashboard". */
  viewName?: string;
}

interface State {
  error: Error | null;
  hasError: boolean;
}

/**
 * Class-based error boundary that catches render-time errors in child views.
 * Wrap each view in MainLayout with this so a single crash doesn't white-screen
 * the entire app — the user can click Retry to remount the view.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    debugLog('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8 text-center"
          role="alert"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-destructive/20 blur-xl" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
              <AlertTriangle aria-hidden="true" className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold">
              {this.props.viewName ? `${this.props.viewName} crashed` : 'View crashed'}
            </p>
            <p className="text-muted-foreground text-sm">
              {this.state.error?.message ?? 'An unexpected render error occurred.'}
            </p>
          </div>
          <Button onClick={this.handleRetry} size="sm" variant="outline">
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
