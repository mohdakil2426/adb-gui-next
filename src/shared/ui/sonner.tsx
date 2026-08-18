import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import type { CSSProperties } from 'react';
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
  '--normal-bg': 'var(--surface-raised)',
  '--normal-text': 'var(--foreground)',
  '--normal-border': 'var(--border)',
  '--border-radius': 'var(--radius)',

  '--success-bg': 'color-mix(in oklab, var(--success) 8%, var(--surface-raised))',
  '--success-border': 'color-mix(in oklab, var(--success) 28%, var(--border))',
  '--success-text': 'var(--foreground)',

  '--error-bg': 'color-mix(in oklab, var(--destructive) 8%, var(--surface-raised))',
  '--error-border': 'color-mix(in oklab, var(--destructive) 28%, var(--border))',
  '--error-text': 'var(--foreground)',

  '--warning-bg': 'color-mix(in oklab, var(--warning) 8%, var(--surface-raised))',
  '--warning-border': 'color-mix(in oklab, var(--warning) 28%, var(--border))',
  '--warning-text': 'var(--foreground)',

  '--info-bg': 'color-mix(in oklab, var(--info) 8%, var(--surface-raised))',
  '--info-border': 'color-mix(in oklab, var(--info) 28%, var(--border))',
  '--info-text': 'var(--foreground)',
} as CSSProperties;

const Toaster = ({ style, ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4 text-info" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />,
      }}
      style={{ ...TOAST_TOKENS, ...style }}
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      toastOptions={{
        classNames: {
          closeButton:
            '!bg-surface-raised !border-border !text-muted-foreground hover:!text-foreground',
          description: 'text-caption text-muted-foreground',
          title: 'text-body font-medium text-foreground',
          toast: 'border-border shadow-lg bg-surface-raised',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
