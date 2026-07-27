import { Loader2 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/shared/ui/button';

interface LoadingButtonProps extends ComponentProps<typeof Button> {
  /** Icon shown when idle. Swapped for a spinner while `isLoading`. */
  icon: ReactNode;
  /** Shows a spinner and disables the button. */
  isLoading: boolean;
  /** Label substituted while loading — end it with an ellipsis character. */
  loadingLabel?: string;
}

/**
 * A `Button` that swaps its icon for a spinner and optionally its label while an
 * action runs. Spacing comes from the button's own `gap-2`; the icon carries no
 * margin of its own.
 */
export function LoadingButton({
  isLoading,
  icon,
  loadingLabel,
  children,
  disabled,
  size = 'sm',
  type = 'button',
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      aria-busy={isLoading}
      disabled={disabled ?? isLoading}
      size={size}
      type={type}
      {...props}
    >
      {isLoading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : icon}
      {isLoading && loadingLabel ? loadingLabel : children}
    </Button>
  );
}
