import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/shared/utils/cn";

const Empty = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    className={cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance rounded-lg border-dashed p-6 text-center",
      className
    )}
    data-slot="empty"
    {...props}
  />
);

const EmptyHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    className={cn("flex max-w-sm flex-col items-center gap-2 text-center", className)}
    data-slot="empty-header"
    {...props}
  />
);

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
      },
    },
  }
);

const EmptyMedia = ({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) => (
  <div
    className={cn(emptyMediaVariants({ className, variant }))}
    data-slot="empty-icon"
    data-variant={variant}
    {...props}
  />
);

/**
 * A heading element, not a `<div>`: an empty state is the only content in its
 * region, so screen-reader users need it in the document outline. `h3` sits
 * under the view's `h1` and any surrounding `CardTitle` (`h2`).
 */
const EmptyTitle = ({ className, children, ...props }: React.ComponentProps<"h3">) => (
  <h3 className={cn("text-title tracking-tight", className)} data-slot="empty-title" {...props}>
    {children}
  </h3>
);

const EmptyDescription = ({ className, ...props }: React.ComponentProps<"p">) => (
  <div
    className={cn(
      "text-body text-muted-foreground [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
      className
    )}
    data-slot="empty-description"
    {...props}
  />
);

const EmptyContent = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div
    className={cn(
      "flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-body",
      className
    )}
    data-slot="empty-content"
    {...props}
  />
);

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
