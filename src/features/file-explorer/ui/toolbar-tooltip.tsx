import type { ReactElement } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

interface ToolbarTooltipProps {
  children: ReactElement;
  label: string;
}

export const ToolbarTooltip = ({ label, children }: ToolbarTooltipProps) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={6}>
      {label}
    </TooltipContent>
  </Tooltip>
);
