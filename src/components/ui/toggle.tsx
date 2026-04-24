import * as React from 'react';
import { Toggle as TogglePrimitive } from 'radix-ui';

import { toggleVariants, type ToggleVariants } from '@/components/ui/toggle-variants';
import { cn } from '@/lib/utils';

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & ToggleVariants) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle };
