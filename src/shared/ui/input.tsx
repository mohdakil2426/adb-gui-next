import type * as React from "react";

import { cn } from "@/shared/utils/cn";

const Input = ({ className, type, ...props }: React.ComponentProps<"input">) => (
  <input
    aria-label={props["aria-label"] || props.placeholder || "Input field"}
    className={cn(
      "border-border-control text-body selection:bg-primary selection:text-primary-foreground file:text-body file:text-foreground placeholder:text-muted-foreground dark:bg-input/30 h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
      "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
      "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
      className
    )}
    data-slot="input"
    type={type}
    {...props}
  />
);

export { Input };
