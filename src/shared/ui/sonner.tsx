import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

/**
 * Toast theming.
 *
 * Sonner ships its own `richColors` palette (raw `hsl()` literals declared on
 * `[data-sonner-toaster][data-sonner-theme='…']`), so a success toast rendered
 * green in sonner's hue while the rest of the app used `--success`. Every one of
 * those variables is re-declared here as an inline style on the toaster root —
 * inline wins over the stylesheet's selectors — so toasts resolve to the app's
 * own tokens in both themes and `richColors` becomes a shape, not a palette.
 *
 * Text colours are mixed toward `--foreground` (the same recipe as the
 * device-status tokens) because the raw status hues are tuned for solid fills
 * and fall under 4.5:1 on a lightly tinted surface in the light theme.
 */
const TOAST_TOKENS = {
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--popover-foreground)',
  '--normal-border': 'var(--border)',
  '--border-radius': 'var(--radius)',

  '--success-bg': 'color-mix(in oklch, var(--success) 12%, var(--popover))',
  '--success-border': 'color-mix(in oklch, var(--success) 32%, var(--border))',
  '--success-text': 'color-mix(in oklab, var(--success) 72%, var(--foreground))',

  '--error-bg': 'color-mix(in oklch, var(--destructive) 12%, var(--popover))',
  '--error-border': 'color-mix(in oklch, var(--destructive) 32%, var(--border))',
  '--error-text': 'color-mix(in oklab, var(--destructive) 72%, var(--foreground))',

  '--warning-bg': 'color-mix(in oklch, var(--warning) 12%, var(--popover))',
  '--warning-border': 'color-mix(in oklch, var(--warning) 32%, var(--border))',
  '--warning-text': 'color-mix(in oklab, var(--warning) 72%, var(--foreground))',

  '--info-bg': 'color-mix(in oklch, var(--info) 12%, var(--popover))',
  '--info-border': 'color-mix(in oklch, var(--info) 32%, var(--border))',
  '--info-text': 'color-mix(in oklab, var(--info) 72%, var(--foreground))',
} as React.CSSProperties;

const Toaster = ({ style, ...props }: ToasterProps) => (
  <Sonner
    className="toaster group"
    icons={{
      success: <CircleCheckIcon className="size-4" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4" />,
      error: <OctagonXIcon className="size-4" />,
      loading: <Loader2Icon className="size-4 animate-spin" />,
    }}
    style={{ ...TOAST_TOKENS, ...style }}
    theme="system"
    toastOptions={{ classNames: { title: 'text-body', description: 'text-caption' } }}
    {...props}
  />
);

export { Toaster };
