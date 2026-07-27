import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Button styling.
 *
 * Depth comes from a solid fill plus a 1px inset top highlight
 * (`--control-highlight`), never from an outer glow: the previous
 * `shadow-[0_0_15px_…var(--primary)…]` rendered a black halo in light mode,
 * where `--primary` was black. Hover and active both *increase* contrast, in
 * both themes, via dedicated `-hover` / `-active` tokens.
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-body outline-none transition-colors duration-90 ease-standard focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[inset_0_1px_0_0_var(--control-highlight)] hover:bg-primary-hover focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-primary-active',
        destructive:
          'bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_0_var(--control-highlight)] hover:bg-destructive-hover focus-visible:ring-destructive/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-destructive-active',
        outline:
          'border border-border bg-surface text-foreground hover:border-border-strong hover:bg-accent active:bg-accent-active',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent active:bg-accent-active',
        ghost: 'hover:bg-accent hover:text-accent-foreground active:bg-accent-active',
        link: 'text-primary underline-offset-4 hover:text-primary-hover hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
