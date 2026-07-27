import { cva } from 'class-variance-authority';

/**
 * Badge styling.
 *
 * Badges are metadata, not emphasis: they use `text-caption` (11px / 500 with
 * a hair of tracking) from the type scale. Solid fills are reserved for the
 * status vocabulary (success / warning / destructive); `info` and `neutral`
 * are soft tints so a screen full of chips does not shout.
 */
export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border border-transparent px-2 py-0.5 font-medium text-caption transition-[color,background-color,border-color,box-shadow] duration-90 ease-standard focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/60 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a&]:hover:bg-primary-hover',
        secondary: 'border-border bg-secondary text-secondary-foreground [a&]:hover:bg-accent',
        destructive:
          'bg-destructive text-destructive-foreground focus-visible:ring-destructive/50 [a&]:hover:bg-destructive-hover',
        success: 'bg-success text-success-foreground [a&]:hover:bg-success/90',
        warning: 'bg-warning text-warning-foreground [a&]:hover:bg-warning/90',
        info: 'border-info/25 bg-info-muted text-info [a&]:hover:bg-info/20',
        neutral: 'border-border bg-muted text-muted-foreground [a&]:hover:bg-accent',
        outline:
          'border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        ghost: '[a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 [a&]:hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);
