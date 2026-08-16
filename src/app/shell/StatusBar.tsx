import { Loader2, Smartphone, X } from 'lucide-react';
import { useDeviceStore } from '@/shared/stores/deviceStore';
import { useNickname } from '@/shared/stores/nicknameStore';
import { useActiveOperation, usePendingOperationCount } from '@/shared/stores/operationStore';
import { cn } from '@/shared/utils/cn';

export type AdbServerState = 'checking' | 'ready' | 'unreachable';

const ADB_STATE_LABEL: Record<AdbServerState, string> = {
  checking: 'checking…',
  ready: 'ready',
  unreachable: 'unreachable',
};

const ADB_STATE_DOT: Record<AdbServerState, string> = {
  checking: 'bg-warning',
  ready: 'bg-success',
  unreachable: 'bg-destructive',
};

function AdbSegment({ state }: { state: AdbServerState }) {
  const label = `ADB ${ADB_STATE_LABEL[state]}`;
  return (
    <span className="flex shrink-0 items-center gap-1.5" title={label}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', ADB_STATE_DOT[state])} />
      <span className="font-mono text-mono-sm">adb</span>
      <span className="sr-only">{ADB_STATE_LABEL[state]}</span>
    </span>
  );
}

function DeviceSegment() {
  const selectedSerial = useDeviceStore((state) => state.selectedSerial);
  // Primitive selector — the status bar re-renders only when this device's
  // connection state actually changes, not on every poll.
  const status = useDeviceStore(
    (state) =>
      state.devices.find((device) => device.serial === state.selectedSerial)?.status ?? null,
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
      <span className="truncate text-foreground">{nickname ?? selectedSerial}</span>
    </span>
  );
}

function OperationSegment() {
  const operation = useActiveOperation();
  const pending = usePendingOperationCount();

  if (!operation) {
    return null;
  }

  const percent =
    operation.progress === null ? null : Math.max(0, Math.min(100, Math.round(operation.progress)));

  return (
    <span className="ml-auto flex min-w-0 items-center gap-2">
      <Loader2 aria-hidden="true" className="size-3 shrink-0 animate-spin text-primary" />
      <span className="truncate text-foreground">{operation.label}</span>
      {operation.detail ? <span className="shrink-0 truncate">{operation.detail}</span> : null}
      {percent === null ? null : (
        <>
          <span
            aria-hidden="true"
            className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-border"
          >
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-200 ease-standard"
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="numeric shrink-0 text-foreground">{percent}%</span>
        </>
      )}
      {pending > 0 ? <span className="numeric shrink-0">+{pending}</span> : null}
      {operation.cancel ? (
        <button
          aria-label={`Cancel ${operation.label}`}
          className="flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onClick={operation.cancel}
          type="button"
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      ) : null}
    </span>
  );
}

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
export function StatusBar({ adbState }: StatusBarProps) {
  return (
    <section
      aria-label="Status bar"
      className="flex h-6.5 shrink-0 items-center gap-3 bg-surface px-3 text-caption text-muted-foreground"
    >
      <AdbSegment state={adbState} />
      <DeviceSegment />
      <OperationSegment />
    </section>
  );
}
