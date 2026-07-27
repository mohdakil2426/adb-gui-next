import { Loader2, RefreshCw } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';

type RefreshButtonBase = {
  className?: string | undefined;
  disabled?: boolean | undefined;
  isLoading?: boolean | undefined;
  onClick: () => void;
};

type RefreshButtonIcon = RefreshButtonBase & {
  /** Icon-only button for toolbars. Requires aria-label. */
  mode: 'icon';
  'aria-label': string;
  /**
   * @deprecated Toolbar icon controls are 32px app-wide (`icon-sm`). This escape
   * hatch exists only for the call sites that still pass `icon`; do not add more.
   */
  buttonSize?: ComponentProps<typeof Button>['size'] | undefined;
  buttonVariant?: ComponentProps<typeof Button>['variant'] | undefined;
  /** Tooltip text rendered around the button. */
  tooltip?: string | undefined;
};

type RefreshButtonAction = RefreshButtonBase & {
  /** Text+icon button for standalone actions. */
  mode: 'action';
  buttonVariant?: ComponentProps<typeof Button>['variant'] | undefined;
  label: string;
  /** Alternate label shown while isLoading is true. */
  loadingLabel?: string | undefined;
};

type RefreshButtonProps = RefreshButtonIcon | RefreshButtonAction;

/**
 * The one refresh control in the app.
 *
 * - `mode="icon"` — 32px icon-only button with tooltip and aria-label, for toolbars.
 * - `mode="action"` — small text+icon button with an optional loading label.
 *
 * Both sizes are fixed here rather than at the call site: the ten call sites had
 * previously drifted to five different heights.
 */
export function RefreshButton(props: RefreshButtonProps) {
  const { className, disabled = false, isLoading = false, mode, onClick } = props;

  const buttonVariant = props.buttonVariant ?? (mode === 'icon' ? 'ghost' : 'outline');

  if (mode === 'icon') {
    const { 'aria-label': ariaLabel, buttonSize, tooltip } = props;
    const button = (
      <Button
        aria-label={ariaLabel}
        className={cn('shrink-0', className)}
        disabled={disabled || isLoading}
        onClick={onClick}
        size={buttonSize ?? 'icon-sm'}
        type="button"
        variant={buttonVariant}
      >
        {isLoading ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <RefreshCw aria-hidden="true" className="size-4" />
        )}
      </Button>
    );

    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom">{tooltip}</TooltipContent>
        </Tooltip>
      );
    }

    return button;
  }

  // mode === 'action'
  const { label, loadingLabel } = props;
  return (
    <Button
      className={className}
      disabled={disabled || isLoading}
      onClick={onClick}
      size="sm"
      type="button"
      variant={buttonVariant}
    >
      {isLoading ? (
        <Loader2 aria-hidden="true" className="animate-spin" />
      ) : (
        <RefreshCw aria-hidden="true" />
      )}
      {isLoading && loadingLabel ? loadingLabel : label}
    </Button>
  );
}
