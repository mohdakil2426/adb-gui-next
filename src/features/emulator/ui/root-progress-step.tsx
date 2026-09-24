import { Circle, CircleCheck, CircleX, Loader2 } from "lucide-react";

import type { backend } from "@/desktop/models";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

const STEP_LABELS = [
  "Checking your emulator is ready…",
  "Downloading Magisk (root toolkit)…",
  "Unpacking Magisk files…",
  "Sending files to your emulator…",
  "Applying root patch to boot image…",
  "Retrieving patched boot image…",
  "Saving patch and stopping emulator…",
  "Patch installed. Cold boot to verify root…",
];

interface RootProgressStepProps {
  avdName: string;
  error: string | null;
  onCancel: () => void;
  progress: backend.RootProgress | null;
}
const StepIcon = ({
  isActive,
  isDone,
  isFailed,
}: {
  isActive: boolean;
  isDone: boolean;
  isFailed: boolean;
}) => {
  if (isFailed) {
    return <CircleX aria-hidden="true" className="text-destructive size-4" />;
  }
  if (isDone) {
    return <CircleCheck aria-hidden="true" className="text-success size-4" />;
  }
  if (isActive) {
    return <Loader2 aria-hidden="true" className="text-primary size-4 animate-spin" />;
  }
  return <Circle aria-hidden="true" className="text-foreground-subtle size-4" />;
};

export const RootProgressStep = ({ progress, error, avdName, onCancel }: RootProgressStepProps) => {
  const currentStep = progress?.step ?? 0;
  const totalSteps = progress?.totalSteps ?? STEP_LABELS.length;
  const failed = error !== null;
  // The backend reports which of N steps is running, not how much work each one
  // costs — the download and the patch dominate. So this is labelled as step
  // position rather than dressed up as a completion percentage it cannot know.
  const completedRatio = totalSteps > 0 ? Math.max(0, currentStep - 1) / totalSteps : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-title">{failed ? "Rooting failed" : "Rooting in progress"}</h3>
        <p className="text-body text-muted-foreground mt-0.5">
          {failed
            ? error
            : `The boot image on ${avdName} is being modified to include Magisk's root tools.`}
        </p>
      </div>

      <ol className="flex flex-col gap-2">
        {STEP_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const isDone = !failed && stepNumber < currentStep;
          const isActive = !failed && stepNumber === currentStep;
          const isFailed = failed && stepNumber === currentStep;

          return (
            <li
              className={cn(
                "text-body flex items-start gap-3",
                isActive && "text-foreground font-medium",
                isFailed && "text-destructive font-medium",
                isDone && "text-foreground",
                !(isDone || isActive || isFailed) && "text-muted-foreground"
              )}
              id={`root-step-${stepNumber}`}
              key={label}
            >
              <span className="mt-0.5 shrink-0">
                <StepIcon isActive={isActive} isDone={isDone} isFailed={isFailed} />
              </span>
              <div className="min-w-0">
                <span>{label}</span>
                {isActive && progress?.detail ? (
                  <p className="text-caption text-muted-foreground mt-0.5">{progress.detail}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {failed ? null : (
        <div className="flex flex-col gap-1">
          <div
            aria-hidden="true"
            className="bg-surface-raised h-1 w-full overflow-hidden rounded-full"
          >
            <div
              // oxlint-disable-next-line shadcn/no-arbitrary-values -- targeted width animation avoids forbidden transition-all
              className="bg-primary ease-standard h-full w-(--progress-width) rounded-full transition-[width] duration-200"
              style={{ "--progress-width": `${completedRatio * 100}%` } as React.CSSProperties}
            />
          </div>
          <output aria-live="polite" className="numeric text-caption text-muted-foreground">
            Step {Math.max(1, currentStep)} of {totalSteps} — steps take different amounts of time,
            so this is position, not elapsed work.
          </output>
        </div>
      )}

      {failed ? null : (
        <Button
          className="w-full"
          id="root-cancel-button"
          onClick={onCancel}
          size="sm"
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      )}
    </div>
  );
};
