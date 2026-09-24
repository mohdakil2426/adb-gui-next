import { AlertTriangle } from "lucide-react";
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { Button } from "@/shared/ui/button";
import { debugLog } from "@/shared/utils/debug";

interface Props {
  children: ReactNode;
  onReset?: () => void;
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
    this.state = { error: null, hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    debugLog(
      `[ErrorBoundary:${this.props.viewName ?? "unknown"}] Uncaught render error:`,
      error,
      info.componentStack
    );
  }

  handleReset = (): void => {
    this.props.onReset?.();
    // eslint-disable-next-line react/no-set-state -- ErrorBoundary class component state recovery
    this.setState({ error: null, hasError: false });
  };

  resetErrorBoundary = this.handleReset;

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-50 flex-col items-center justify-center gap-4 p-8 text-center"
          role="alert"
        >
          {/* Depth from a surface step and a hairline border — the previous
              blurred halo was invisible on the dark canvas and a smudge on light. */}
          <div className="border-destructive/30 bg-destructive-muted flex size-10 items-center justify-center rounded-lg border">
            <AlertTriangle aria-hidden="true" className="text-destructive size-5" />
          </div>
          <div className="flex max-w-md flex-col gap-1">
            <p className="text-title">
              {this.props.viewName ? `${this.props.viewName} crashed` : "View crashed"}
            </p>
            <p className="text-body text-muted-foreground">
              {this.state.error?.message ?? "An unexpected render error occurred."}
            </p>
            <p className="text-caption text-foreground-subtle">
              Retry re-mounts this view. If it crashes again, open the Logs panel — the full stack
              is recorded there.
            </p>
          </div>
          <Button
            aria-label={
              this.props.viewName ? `Retry loading ${this.props.viewName}` : "Retry loading view"
            }
            onClick={this.handleReset}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
