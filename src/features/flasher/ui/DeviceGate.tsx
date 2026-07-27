import { Info } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Says why an action is unavailable and what to do about it.
 *
 * A disabled button with no explanation reads as a broken app; this is the
 * "smart gate, not a dead end" pattern the AVD root wizard already uses.
 */
export function DeviceGate({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-2 text-caption text-muted-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
