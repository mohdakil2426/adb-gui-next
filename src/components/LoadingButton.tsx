import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';

interface LoadingButtonProps extends ComponentProps<typeof Button> {
  /** Whether the button should show a spinner and be disabled */
  isLoading: boolean;
  /** Icon to show when not loading */
  icon: React.ReactNode;
  /** Optional label override shown while loading (e.g. "Flashing...") */
  loadingLabel?: string;
}

/**
 * A Button with a built-in loading state that replaces the icon with a spinner
 * and optionally substitutes a different label while the action is in progress.
 */
export function LoadingButton({
  isLoading,
  icon,
  loadingLabel,
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || isLoading} {...props}>
      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : icon}
      {isLoading && loadingLabel ? loadingLabel : children}
    </Button>
  );
}
