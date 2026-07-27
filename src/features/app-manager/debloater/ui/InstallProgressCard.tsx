import { useEffect, useState } from 'react';
import type { InstallProgress } from '@/features/app-manager/debloater/model/installationStore';
import { Progress } from '@/shared/ui/progress';
import { formatDuration } from '@/shared/utils/format';

const PERCENT = 100;
const TICK_MS = 1000;

/** Seconds since `startedAt`, ticking once a second. */
function useElapsedSeconds(startedAt: number): number {
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - startedAt) / TICK_MS));

  useEffect(() => {
    setElapsed(Math.floor((Date.now() - startedAt) / TICK_MS));
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / TICK_MS));
    }, TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [startedAt]);

  return elapsed;
}

/**
 * Honest batch-install feedback.
 *
 * `adb install` is silent until a file lands, so the bar can only track files
 * completed. The file name and a running clock carry the rest — without them a
 * single large APK looked like a hang.
 */
export function InstallProgressCard({ progress }: { progress: InstallProgress }) {
  const elapsed = useElapsedSeconds(progress.startedAt);
  const ratio = progress.total === 0 ? 0 : progress.completed / progress.total;

  return (
    <output
      aria-live="polite"
      className="flex w-full flex-col gap-2 rounded-lg border border-border bg-surface-raised px-3 py-2.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="numeric font-medium text-body text-foreground">
          Installing {Math.min(progress.completed + 1, progress.total)} of {progress.total}
        </span>
        <span className="numeric text-caption text-muted-foreground">
          {formatDuration(elapsed)} elapsed
        </span>
      </div>

      <Progress value={Math.round(ratio * PERCENT)} />

      {progress.currentFile ? (
        <span className="truncate font-mono text-mono text-muted-foreground">
          {progress.currentFile}
        </span>
      ) : null}

      <span className="text-caption text-muted-foreground">
        A large APK can take several minutes. ADB reports nothing until each file finishes, so the
        bar advances one file at a time.
      </span>
    </output>
  );
}
