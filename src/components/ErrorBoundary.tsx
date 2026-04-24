import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { debugLog } from '@/lib/debug';

interface Props {
  children: ReactNode;
  /** Shown in the error message, e.g. "Dashboard". */
  viewName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
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

  componentDidCatch(error: Error, info: ErrorInfo): void {
    debugLog('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-4 p-8 min-h-[200px] text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-destructive/20 blur-xl rounded-full" />
            <div className="relative h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold">
              {this.props.viewName ? `${this.props.viewName} crashed` : 'View crashed'}
            </p>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message ?? 'An unexpected render error occurred.'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
