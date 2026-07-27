import { Info } from 'lucide-react';
import { Button } from '@/shared/ui/button';

interface UtilitiesGateProps {
  /** The one thing that unblocks this panel, offered inline. */
  action?: { label: string; onClick: () => void } | undefined;
  message: string;
  title: string;
}

/**
 * Replaces a wall of silently disabled buttons with the reason they are
 * disabled and the way out — "smart gate, not a dead end".
 */
export function UtilitiesGate({ action, message, title }: UtilitiesGateProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-info/30 bg-info-muted px-3 py-2.5">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium text-body">{title}</p>
        <p className="text-body text-muted-foreground">{message}</p>
      </div>
      {action ? (
        <Button className="shrink-0" onClick={action.onClick} size="sm" variant="outline">
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
