import type * as React from "react";

import { cn } from "@/shared/utils/cn";

const Kbd = ({ className, ...props }: React.ComponentProps<"kbd">) => (
  <kbd
    className={cn(
      "pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm border border-border bg-muted px-1 font-sans text-caption text-muted-foreground",
      "[&_svg:not([class*='size-'])]:size-3",
      className
    )}
    data-slot="kbd"
    {...props}
  />
);

const KbdGroup = ({ className, ...props }: React.ComponentProps<"div">) => (
  <kbd
    className={cn("inline-flex items-center gap-1", className)}
    data-slot="kbd-group"
    {...props}
  />
);

export { Kbd, KbdGroup };
