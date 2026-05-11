import { Slot } from '@radix-ui/react-slot';
import type * as React from 'react';

import { type ButtonVariants, buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  ButtonVariants & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      {...props}
    />
  );
}

export { Button };
