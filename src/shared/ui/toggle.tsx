import { Toggle as TogglePrimitive } from 'radix-ui';
import type * as React from 'react';
import { type ToggleVariants, toggleVariants } from '@/shared/ui/toggle-variants';
import { cn } from '@/shared/utils/cn';

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & ToggleVariants) {
  return (
    <TogglePrimitive.Root
      className={cn(toggleVariants({ variant, size, className }))}
      data-slot="toggle"
      {...props}
    />
  );
}

export { Toggle };
