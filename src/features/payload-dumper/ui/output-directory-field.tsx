import { ExternalLink, FolderOutput } from "lucide-react";
import { memo } from "react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

interface OutputDirectoryFieldProps {
  disabled: boolean;
  /** `outputDir` (where the last extraction actually wrote) or `outputPath`. */
  effectiveOutputPath: string;
  /** True when the path was chosen by the backend, not by the user. */
  isAuto: boolean;
  onOpenOutputFolder: () => void;
  onSelectOutput: () => void;
}

/**
 * Where the images land — a required input, given a label and a real control.
 *
 * It was previously an unlabelled 28px ghost icon button in a row of four
 * identical ones, with the current destination visible only as a tooltip. It is
 * now the second thing on the screen after the payload itself, and says what
 * happens when it is left unset instead of leaving that to be discovered.
 */
const OutputDirectoryFieldImpl = ({
  disabled,
  effectiveOutputPath,
  isAuto,
  onOpenOutputFolder,
  onSelectOutput,
}: OutputDirectoryFieldProps) => {
  const isSet = effectiveOutputPath.length > 0;

  return (
    <div className="border-border bg-surface-raised flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-caption text-muted-foreground flex items-center gap-1.5 tracking-wide uppercase">
          <FolderOutput aria-hidden="true" className="size-3.5" />
          Output directory
          {isAuto && isSet ? (
            <span className="bg-muted text-caption rounded-sm px-1 tracking-normal normal-case">
              auto
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            "text-mono min-w-0 font-mono break-all",
            isSet ? "text-foreground" : "text-muted-foreground"
          )}
          title={effectiveOutputPath || undefined}
        >
          {isSet
            ? effectiveOutputPath
            : "Not set — images go to an “extracted_…” folder chosen automatically."}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          disabled={disabled}
          onClick={onSelectOutput}
          size="sm"
          type="button"
          variant="outline"
        >
          {isSet ? "Change…" : "Choose…"}
        </Button>
        {isSet ? (
          <Button
            aria-label="Open output folder"
            onClick={onOpenOutputFolder}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ExternalLink aria-hidden="true" className="size-4" data-icon="inline-start" />
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export const OutputDirectoryField = memo(OutputDirectoryFieldImpl);
