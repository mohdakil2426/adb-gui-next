import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

const STEP_LABELS = [
  'Checking your emulator is ready…',
  'Downloading Magisk (root toolkit)…',
  'Unpacking Magisk files…',
  'Sending files to your emulator…',
  'Applying root patch to boot image…',
  'Retrieving patched boot image…',
  'Saving patch and stopping emulator…',
  'Patch installed. Cold boot to verify root…',
];

interface RootProgressStepProps {
  avdName: string;
  error: string | null;
  onCancel: () => void;
  progress: backend.RootProgress | null;
}

export function RootProgressStep({ progress, error, avdName, onCancel }: RootProgressStepProps) {
  const currentStep = progress?.step ?? 0;
  const percent = progress ? Math.round((progress.step / progress.totalSteps) * 100) : 0;
  const failed = error !== null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="font-semibold text-base text-foreground">
          {failed ? 'Rooting Failed' : 'Rooting in Progress'}
        </h3>
        <p className="mt-0.5 text-muted-foreground text-sm">
          {failed
            ? error
            : `The boot image on ${avdName} is being modified to include Magisk's root tools.`}
        </p>
      </div>

      {/* Step checklist */}
      <div className="flex flex-col gap-2">
        {STEP_LABELS.map((label, index) => {
          const stepNumber = index + 1;
          const isDone = !failed && stepNumber < currentStep;
          const isActive = !failed && stepNumber === currentStep;
          const isFailed = failed && stepNumber === currentStep;

          return (
            <div
              className={cn(
                'flex items-start gap-3 text-sm',
                isDone && 'text-foreground',
                isActive && 'font-medium text-foreground',
                isFailed && 'font-medium text-destructive',
                !(isDone || isActive || isFailed) && 'text-muted-foreground',
              )}
              id={`root-step-${stepNumber}`}
              key={stepNumber}
            >
              <span className="mt-0.5 shrink-0">
                {isFailed ? (
                  <XCircle className="size-4 text-destructive" />
                ) : isDone ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : isActive ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <Circle className="size-4 text-muted-foreground/40" />
                )}
              </span>
              <div>
                <span>{label}</span>
                {isActive && progress?.detail ? (
                  <p className="mt-0.5 text-muted-foreground text-xs">{progress.detail}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {!failed && (
        <div className="gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-right text-muted-foreground text-xs">{percent}%</p>
        </div>
      )}

      {/* Cancel */}
      {!failed && (
        <Button className="w-full" id="root-cancel-button" onClick={onCancel} variant="outline">
          Cancel
        </Button>
      )}
    </div>
  );
}
