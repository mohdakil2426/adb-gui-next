import { Check } from "lucide-react";
import { memo } from "react";

import { cn } from "@/shared/utils/cn";

interface CheckboxItemProps {
  checked: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * The selection *indicator* drawn inside virtualised rows (debloat and installed
 * package lists, payload partition list).
 *
 * Deliberately not `ui/checkbox.tsx`: the row itself is the interactive control
 * and owns `role`/`aria-selected`, so this is presentation only — mounting a
 * Radix checkbox per virtual row would add a second focus target and a listener
 * to every row. It is `aria-hidden` for exactly that reason.
 */
const CheckboxItemImpl = ({ checked, disabled = false, className }: CheckboxItemProps) => (
  <div
    aria-hidden="true"
    className={cn(
      "ease-standard flex size-4 shrink-0 items-center justify-center rounded-sm border transition-colors duration-90",
      checked && "border-primary bg-primary",
      !checked && disabled && "border-border opacity-50",
      !(checked || disabled) && "border-border-strong",
      className
    )}
  >
    {checked ? <Check className="text-primary-foreground size-3" /> : null}
  </div>
);

export const CheckboxItem = memo(CheckboxItemImpl);
