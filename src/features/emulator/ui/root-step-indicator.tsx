import { Check } from "lucide-react";

import { cn } from "@/shared/utils/cn";

const STEPS = ["Preflight", "Setup", "Patching", "Verify"];

interface RootStepIndicatorProps {
  stepIndex: number;
}

export const RootStepIndicator = ({ stepIndex }: RootStepIndicatorProps) => (
  <ol aria-label="Root workflow progress" className="flex items-center gap-2">
    {STEPS.map((label, idx) => {
      const done = idx < stepIndex;
      const active = idx === stepIndex;
      return (
        <li className="flex items-center gap-2" key={label}>
          <span
            className={cn(
              "numeric text-caption ease-standard flex size-5 items-center justify-center rounded-full border transition-colors duration-90",
              done && "border-success bg-success text-success-foreground",
              active && "border-primary bg-primary text-primary-foreground",
              !(done || active) && "border-border bg-surface text-muted-foreground"
            )}
          >
            {done ? <Check aria-hidden="true" className="size-3" /> : idx + 1}
          </span>
          <span
            className={cn(
              "text-body",
              active ? "text-foreground font-medium" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
          {idx < STEPS.length - 1 ? (
            <span
              aria-hidden="true"
              className={cn(
                "ease-standard h-px w-6 transition-colors duration-90",
                done ? "bg-success" : "bg-border"
              )}
            />
          ) : null}
        </li>
      );
    })}
  </ol>
);
