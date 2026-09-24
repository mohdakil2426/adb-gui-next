import { Check, Clock, Globe, Loader2, Radio, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import type { backend } from "@/desktop/models";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/utils/cn";

const STEP_DEFINITIONS = [
  {
    desc: "HTTP Range header verification",
    step: 1,
    title: "Verify connection",
  },
  {
    desc: "Central Directory & EOCD records",
    step: 2,
    title: "Locate ZIP index",
  },
  {
    desc: "OTA payload.bin / Factory manifest",
    step: 3,
    title: "Detect format",
  },
  {
    desc: "Parse partition table & metadata",
    step: 4,
    title: "Read partition list",
  },
] as const;

const PHASE_TO_STEP: Record<backend.PayloadLoadPhase, number> = {
  detectFormat: 3,
  done: 4,
  error: 0,
  locateIndex: 2,
  readPartitions: 4,
  verifyConnection: 1,
};

export interface RemoteLoadProgressCardProps {
  detail?: string | null | undefined;
  estimatedSizeLabel?: string | null | undefined;
  message?: string | undefined;
  onCancel: () => void;
  phase?: backend.PayloadLoadPhase | null | undefined;
  startedAt: number;
  step?: number | undefined;
  totalSteps?: number | undefined;
}

const formatElapsed = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const resolveActiveStep = (
  phase: backend.PayloadLoadPhase | null | undefined,
  step: number | undefined
): number => {
  if (phase && phase in PHASE_TO_STEP) {
    return PHASE_TO_STEP[phase];
  }
  if (typeof step === "number" && step >= 1) {
    return step;
  }
  return 1;
};

const getStatusLine = (
  message: string | undefined,
  isError: boolean,
  activeStep: number
): string => {
  if (message?.trim()) {
    return message.trim();
  }
  if (isError) {
    return "Unable to read remote archive index.";
  }
  return STEP_DEFINITIONS[activeStep - 1]?.title ?? "Streaming remote manifest…";
};

const renderStepBadgeContent = (done: boolean, working: boolean, stepNum: number) => {
  if (done) {
    return <Check className="size-3" />;
  }
  if (working) {
    return <Loader2 className="size-3 animate-spin" />;
  }
  return stepNum;
};

const StepDefinitionsGrid = ({ activeStep, isError }: { activeStep: number; isError: boolean }) => (
  <div className="grid grid-cols-2 gap-2 @sm:grid-cols-4">
    {STEP_DEFINITIONS.map(({ step: stepNum, title }) => {
      const done = !isError && stepNum < activeStep;
      const working = !isError && stepNum === activeStep;
      const pending = stepNum > activeStep;

      return (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
            done && "border-success/30 bg-success/5 text-success",
            working && "border-primary/50 bg-primary/10 text-foreground font-medium shadow-xs",
            pending && "border-border/60 bg-surface/60 text-muted-foreground",
            isError &&
              stepNum === activeStep &&
              "border-destructive/40 bg-destructive/10 text-destructive"
          )}
          key={stepNum}
        >
          <div
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px]",
              done && "bg-success/20 text-success",
              working && "bg-primary text-primary-foreground",
              pending && "border-border bg-surface text-muted-foreground border",
              isError && stepNum === activeStep && "bg-destructive text-destructive-foreground"
            )}
          >
            {renderStepBadgeContent(done, working, stepNum)}
          </div>
          <span className="truncate text-[11px] leading-tight">{title}</span>
        </div>
      );
    })}
  </div>
);

export const RemoteLoadProgressCard = ({
  phase = null,
  message,
  detail = null,
  step,
  totalSteps = 4,
  estimatedSizeLabel = null,
  startedAt,
  onCancel,
}: RemoteLoadProgressCardProps) => {
  const [now, setNow] = useState(() => Date.now());
  const activeStep = resolveActiveStep(phase, step);
  const isError = phase === "error";
  const isDone = phase === "done";
  const elapsedMs = now - startedAt;
  const elapsedLabel = formatElapsed(elapsedMs);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, []);

  const statusLine = getStatusLine(message, isError, activeStep);

  let slowHint: string | null = null;
  if (!(isError || isDone) && elapsedMs > 40_000) {
    slowHint = "High server latency detected. Checking range headers or retry if stalled.";
  } else if (!(isError || isDone) && elapsedMs > 15_000) {
    slowHint =
      "Streaming remote headers from CDN — large factory packages may take up to a minute.";
  }

  const sizeCopy = estimatedSizeLabel
    ? `Only reading index — not downloading full ${estimatedSizeLabel}`
    : "Streaming package header index without downloading full archive";

  const progressPercent = isError || isDone ? 100 : Math.min(95, Math.max(15, activeStep * 25 - 5));

  return (
    <div
      aria-busy={!(isError || isDone)}
      aria-live="polite"
      className="border-primary/30 bg-surface-raised @container flex flex-col gap-3.5 rounded-xl border p-4 shadow-xs"
    >
      {/* Header Row: Live Pulse Indicator, Title & Live Elapsed Counter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="border-primary/40 bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-lg border">
            <Radio aria-hidden="true" className="size-3.5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-body text-foreground font-semibold">Loading partitions</h3>
            <p className="text-muted-foreground text-[11px]">
              Zero-download partition manifest extraction
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge className="font-mono text-[10px]" variant="outline">
            Phase {Math.min(activeStep, totalSteps)} of {totalSteps}
          </Badge>
          <Badge className="gap-1 font-mono text-[10px]" variant="secondary">
            <span className="bg-primary size-1.5 animate-ping rounded-full" />
            {elapsedLabel}
          </Badge>
        </div>
      </div>

      {/* 4-Phase Stepper Cards */}
      <StepDefinitionsGrid activeStep={activeStep} isError={isError} />

      {/* Animated Multi-Stage Progress Bar */}
      <div
        aria-hidden="true"
        className="bg-border/60 relative h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            isError ? "bg-destructive" : "from-primary to-primary/80 animate-pulse bg-gradient-to-r"
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Telemetry Status Box */}
      <div className="border-border/60 bg-surface text-caption flex flex-col gap-1.5 rounded-lg border px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn("font-medium", isError ? "text-destructive" : "text-foreground")}>
            {statusLine}
          </span>
          <span className="text-muted-foreground font-mono text-[11px]">{sizeCopy}</span>
        </div>

        {detail ? (
          <div className="text-primary/90 flex items-center gap-1.5 font-mono text-[11px]">
            <Globe className="size-3 shrink-0" />
            <span className="truncate" title={detail}>
              {detail}
            </span>
          </div>
        ) : null}

        {slowHint ? (
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-amber-400">
            <Clock className="size-3 shrink-0" />
            <span>{slowHint}</span>
          </div>
        ) : null}
      </div>

      {/* Footer Cancel Action */}
      <div className="flex justify-end pt-0.5">
        <Button
          aria-label="Cancel loading partitions"
          className="text-caption text-destructive hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive h-8 gap-1.5 px-3"
          onClick={onCancel}
          size="sm"
          type="button"
          variant="outline"
        >
          <XCircle aria-hidden="true" className="size-3.5" data-icon="inline-start" />
          Cancel Remote Stream
        </Button>
      </div>
    </div>
  );
};
