import type { ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';

export function ToolbarTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
