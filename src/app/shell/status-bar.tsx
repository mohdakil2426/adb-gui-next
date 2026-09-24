import { Loader2, Smartphone, X } from "lucide-react";

import { useDeviceStore } from "@/shared/stores/device-store";
import { useNickname } from "@/shared/stores/nickname-store";
import { useActiveOperation, usePendingOperationCount } from "@/shared/stores/operation-store";
import { cn } from "@/shared/utils/cn";

export type AdbServerState = "checking" | "ready" | "unreachable";

const ADB_STATE_LABEL: Record<AdbServerState, string> = {
  checking: "checking…",
  ready: "ready",
  unreachable: "unreachable",
};

const ADB_STATE_DOT: Record<AdbServerState, string> = {
  checking: "bg-warning",
  ready: "bg-success",
  unreachable: "bg-destructive",
};

const AdbSegment = ({ state }: { state: AdbServerState }) => {
  const label = `ADB ${ADB_STATE_LABEL[state]}`;
  return (
    <span className="flex shrink-0 items-center gap-1.5" title={label}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", ADB_STATE_DOT[state])} />
      <span className="text-mono-sm font-mono">adb</span>
      <span className="sr-only">{ADB_STATE_LABEL[state]}</span>
    </span>
  );
};

const DeviceSegment = () => {
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  // Primitive selector — the status bar re-renders only when this device's
  // connection state actually changes, not on every poll.
  const status = useDeviceStore(
    (state) =>
      state.devices.find((device) => device.serial === state.selectedSerial)?.status ?? null
  );
  const nickname = useNickname(selectedSerial);

  if (!selectedSerial) {
    return <span className="shrink-0">no device</span>;
  }

  return (
    <span
      className="flex min-w-0 shrink items-center gap-1.5"
      title={status ? `${nickname ?? selectedSerial} (${status})` : (nickname ?? selectedSerial)}
    >
      <Smartphone aria-hidden="true" className="size-3 shrink-0" />
      <span className="text-foreground truncate">{nickname ?? selectedSerial}</span>
    </span>
  );
};

const OperationSegment = () => {
  const operation = useActiveOperation();
  const pending = usePendingOperationCount();

  if (!operation) {
    return null;
  }

  const percent =
    operation.progress === null ? null : Math.max(0, Math.min(100, Math.round(operation.progress)));

  return (
    <span className="ml-auto flex min-w-0 items-center gap-2">
      <Loader2 aria-hidden="true" className="text-primary size-3 shrink-0 animate-spin" />
      <span className="text-foreground truncate">{operation.label}</span>
      {operation.detail ? <span className="shrink-0 truncate">{operation.detail}</span> : null}
      {percent === null ? null : (
        <>
          <span
            aria-hidden="true"
            className="bg-border h-1 w-16 shrink-0 overflow-hidden rounded-full"
          >
            {
              <span
                // oxlint-disable-next-line shadcn/no-arbitrary-values -- width-only progress bar transition avoids transition:all
                className="bg-primary ease-standard block h-full w-(--progress-width) rounded-full transition-[width] duration-200"
                style={{ "--progress-width": `${percent}%` } as React.CSSProperties}
              />
            }
          </span>
          <span className="numeric text-foreground shrink-0">{percent}%</span>
        </>
      )}
      {pending > 0 ? <span className="numeric shrink-0">+{pending}</span> : null}
      {operation.cancel ? (
        <button
          aria-label={`Cancel ${operation.label}`}
          className="text-muted-foreground hover:bg-destructive-muted hover:text-destructive focus-visible:ring-ring flex size-6 shrink-0 items-center justify-center rounded-sm p-1 transition-colors focus-visible:ring-1 focus-visible:outline-none"
          onClick={() => {
            operation.cancel?.();
          }}
          type="button"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </span>
  );
};

interface StatusBarProps {
  adbState: AdbServerState;
}

/**
 * 26px persistent footer: ADB server reachability, the selected device, and the
 * active long operation with determinate progress and a cancel affordance.
 *
 * Every segment subscribes to its own slice, so a progress tick re-renders one
 * span rather than the shell.
 */
export const StatusBar = ({ adbState }: StatusBarProps) => (
  <section
    aria-label="Status bar"
    className="bg-surface text-caption text-muted-foreground flex h-6.5 shrink-0 items-center gap-3 px-3"
  >
    <AdbSegment state={adbState} />
    <DeviceSegment />
    <OperationSegment />
  </section>
);
