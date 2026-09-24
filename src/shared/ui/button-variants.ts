import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

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
  "text-body ease-standard focus-visible:border-ring focus-visible:ring-ring/60 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors duration-90 outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        icon: "size-9",
        "icon-lg": "size-10",
        "icon-sm": "size-8",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
      },
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-offset-background active:bg-primary-active shadow-[inset_0_1px_0_0_var(--control-highlight)] focus-visible:ring-offset-2",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-hover focus-visible:ring-destructive/50 focus-visible:ring-offset-background active:bg-destructive-active shadow-[inset_0_1px_0_0_var(--control-highlight)] focus-visible:ring-offset-2",
        ghost: "hover:bg-accent hover:text-accent-foreground active:bg-accent-active",
        link: "text-primary hover:text-primary-hover underline-offset-4 hover:underline",
        outline:
          "border-border bg-surface text-foreground hover:border-border-strong hover:bg-accent active:bg-accent-active border",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent active:bg-accent-active",
      },
    },
  }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
