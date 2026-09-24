import { Upload } from "lucide-react";
import type React from "react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

interface DropAreaProps {
  browseLabel: string;
  disabled?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  isDragging: boolean;
  label: string;
  onBrowse: () => void;
  sublabel: string;
}

export const DropArea = ({
  isDragging,
  icon: Icon,
  label,
  sublabel,
  browseLabel,
  onBrowse,
  disabled = false,
}: DropAreaProps) => (
  <div
    className={cn(
      // oxlint-disable-next-line shadcn/no-arbitrary-values -- scoped transition properties avoid forbidden transition:all
      "relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-[border-color,background-color,box-shadow,transform] duration-200",
      isDragging
        ? // oxlint-disable-next-line shadcn/no-arbitrary-values -- active dropzone halo shadow uses theme-token color-mix glow
          "border-primary bg-primary/5 scale-[1.01] shadow-[0_0_20px_color-mix(in_oklch,var(--primary)_15%,transparent)]"
        : "border-muted-foreground/25 hover:border-muted-foreground/40",
      disabled && "pointer-events-none opacity-50"
    )}
  >
    {isDragging ? (
      <div className="bg-primary/5 absolute inset-0 z-10 flex items-center justify-center rounded-lg backdrop-blur-xs">
        <div className="fade-in zoom-in-95 animate-in text-primary flex flex-col items-center gap-2">
          <div className="bg-primary/10 rounded-full p-4">
            <Upload className="size-8" />
          </div>
          <p className="text-sm font-semibold">Drop to add file</p>
        </div>
      </div>
    ) : null}

    <div
      className={cn(
        "flex flex-col items-center gap-3 transition-opacity duration-150",
        isDragging && "opacity-0"
      )}
    >
      <div className="bg-muted rounded-full p-3">
        <Icon className="text-muted-foreground/50 size-6" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <p className="text-label text-muted-foreground">or</p>
      </div>
      <Button disabled={disabled} onClick={onBrowse} size="sm" variant="outline">
        {browseLabel}
      </Button>
      <p className="text-label text-muted-foreground">{sublabel}</p>
    </div>
  </div>
);
