import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";

import { buttonVariants } from "@/shared/ui/button-variants";
import type { ButtonVariants } from "@/shared/ui/button-variants";
import { cn } from "@/shared/utils/cn";

const Button = ({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  ButtonVariants & {
    asChild?: boolean;
  }) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ className, size, variant }))}
      data-slot="button"
      {...props}
    />
  );
};

export { Button };
