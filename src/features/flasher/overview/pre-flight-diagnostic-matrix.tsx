import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import type {
  DiagnosticItem,
  DiagnosticStatus,
  FastbootVitals,
} from "@/features/flasher/model/flasher-types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";

interface PreFlightDiagnosticMatrixProps {
  diagnostics?: DiagnosticItem[];
  isFastbootMode: boolean;
  isProbing: boolean;
  onRebootBootloader?: (() => void) | undefined;
  onRefresh: () => void;
  vitals: FastbootVitals;
}

const getDeviceConnectionDiag = (
  vitals: FastbootVitals,
  isFastbootMode: boolean,
  hasDevice: boolean,
  onRebootBootloader?: () => void
): DiagnosticItem => {
  let status: DiagnosticStatus = "fail";
  let tip = "No Android device detected. Connect via USB and put into bootloader mode.";
  if (hasDevice) {
    if (isFastbootMode) {
      status = "pass";
      tip = "Fastboot connection established and ready for partition operations.";
    } else if (vitals.connectionMode === "SIDELOAD") {
      status = "pass";
      tip = "Recovery Sideload transport detected and ready for update packages.";
    } else {
      status = "warn";
      tip = "Device is in ADB mode. Reboot to bootloader for raw partition flashing.";
    }
  }

  return {
    description: "Verifies active hardware connectivity over USB in Fastboot or Sideload mode.",
    fixAction: onRebootBootloader,
    fixLabel: !isFastbootMode && hasDevice && onRebootBootloader ? "Reboot Bootloader" : undefined,
    id: "device-state",
    label: "Device Connection & State",
    status,
    tip,
    value: vitals.connectionMode,
  };
};

const getBootloaderLockDiag = (
  vitals: FastbootVitals,
  hasDevice: boolean,
  isUnlocked: boolean
): DiagnosticItem => {
  let status: DiagnosticStatus = "idle";
  if (hasDevice) {
    if (isUnlocked) {
      status = "pass";
    } else if (vitals.lockState === "LOCKED") {
      status = "fail";
    } else {
      status = "warn";
    }
  }

  let tip = "Bootloader lock state could not be queried.";
  if (isUnlocked) {
    tip = "Bootloader unlocked. Custom kernel, recovery, and dynamic partitions can be flashed.";
  } else if (vitals.lockState === "LOCKED") {
    tip = "Bootloader is LOCKED. Fastboot flash commands will be rejected by bootloader.";
  }

  return {
    description: "Checks if OEM bootloader is unlocked to allow flashing unsigned images.",
    id: "bootloader-lock",
    label: "Bootloader Lock Authorization",
    status,
    tip,
    value: vitals.lockState,
  };
};

const getBatteryGuardDiag = (
  vitals: FastbootVitals,
  hasDevice: boolean,
  isFastbootMode: boolean
): DiagnosticItem => {
  let status: DiagnosticStatus = "idle";
  let value = "N/A";
  if (vitals.batteryLevel === null) {
    if (hasDevice && isFastbootMode) {
      status = "pass";
      value = "Safe (Assumed)";
    }
  } else {
    value = `${vitals.batteryLevel}%`;
    if (hasDevice) {
      status = vitals.isBatterySafe ? "pass" : "warn";
    }
  }

  const tip = vitals.isBatterySafe
    ? "Battery level is sufficient for safe partition flashing operations."
    : `Battery level is at ${vitals.batteryLevel}%. Recommended to charge above 50% before flashing.`;

  return {
    description: "Validates that device battery is ≥50% to prevent bricking from power failure.",
    id: "battery-guard",
    label: "Battery Level Safety Guard",
    status,
    tip,
    value,
  };
};

const getSlotConsistencyDiag = (vitals: FastbootVitals, hasDevice: boolean): DiagnosticItem => {
  let status: DiagnosticStatus = "idle";
  let tip = "Could not resolve active partition slot.";
  let value = "Unknown";

  const isDualSlot = vitals.activeSlot === "a" || vitals.activeSlot === "b";
  if (hasDevice) {
    status = isDualSlot || vitals.activeSlot === "single" ? "pass" : "warn";
  }

  if (isDualSlot) {
    tip = `Dual A/B partition layout detected. Active slot set to _${vitals.activeSlot.toUpperCase()}.`;
    value = `Slot _${vitals.activeSlot.toUpperCase()}`;
  } else if (vitals.activeSlot === "single") {
    tip = "Legacy single-slot partition layout detected (A-only).";
    value = "Single Slot";
  }

  return {
    description: "Verifies dual A/B partition configuration and active boot slot parity.",
    id: "slot-consistency",
    label: "Partition Slot Consistency",
    status,
    tip,
    value,
  };
};

const buildDefaultDiagnostics = (
  vitals: FastbootVitals,
  isFastbootMode: boolean,
  hasDevice: boolean,
  isUnlocked: boolean,
  onRebootBootloader?: () => void
): DiagnosticItem[] => [
  getDeviceConnectionDiag(vitals, isFastbootMode, hasDevice, onRebootBootloader),
  getBootloaderLockDiag(vitals, hasDevice, isUnlocked),
  getBatteryGuardDiag(vitals, hasDevice, isFastbootMode),
  {
    description: "Checks host-to-device transport link stability and Fastboot USB descriptor.",
    id: "usb-transport",
    label: "USB Link & Protocol Stability",
    status: hasDevice ? "pass" : "idle",
    tip: hasDevice
      ? "Direct USB host transport validated with no command timeout drops."
      : "Connect high-quality USB-C / USB-A cable directly to host motherboard.",
    value: hasDevice ? "Direct USB OK" : "No Link",
  },
  {
    description: "Verifies fastboot binary protocol v0.5 response latency and getvar handshake.",
    id: "driver-handshake",
    label: "Platform-Tools Driver Handshake",
    status: hasDevice && isFastbootMode ? "pass" : "idle",
    tip: isFastbootMode
      ? "Fastboot command responder verified and returning valid variable mappings."
      : "Fastboot handshake inactive while device is in other modes.",
    value: isFastbootMode ? "Protocol 0.5" : "N/A",
  },
  getSlotConsistencyDiag(vitals, hasDevice),
];

const renderDiagStatusIcon = (status: DiagnosticStatus) => {
  if (status === "pass") {
    return <CheckCircle2 className="size-4" />;
  }
  if (status === "warn" || status === "fail") {
    return <AlertCircle className="size-4" />;
  }
  if (status === "checking") {
    return <Loader2 className="size-4 animate-spin" />;
  }
  return <HelpCircle className="size-4" />;
};

const DIAG_BADGE_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  fail: "destructive",
  pass: "success",
  warn: "warning",
};

const DiagnosticRow = ({ diag }: { diag: DiagnosticItem }) => (
  <div className="flex @lg:flex-row flex-col @lg:items-center @lg:justify-between gap-2.5 rounded-lg border border-border/70 bg-surface-raised/40 p-3 transition-colors hover:border-border hover:bg-surface-raised/70">
    <div className="flex min-w-0 items-center gap-3">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg border",
          diag.status === "pass" && "border-success/30 bg-success/10 text-success",
          diag.status === "warn" && "border-warning/30 bg-warning/10 text-warning",
          diag.status === "fail" && "border-destructive/30 bg-destructive/10 text-destructive",
          diag.status === "checking" && "border-info/30 bg-info/10 text-info",
          diag.status === "idle" && "border-border bg-surface text-muted-foreground"
        )}
      >
        {renderDiagStatusIcon(diag.status)}
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-body text-foreground">{diag.label}</span>
          {diag.value ? (
            <Badge className="font-mono text-[10px]" variant="outline">
              {diag.value}
            </Badge>
          ) : null}
        </div>
        <span className="text-caption text-muted-foreground">{diag.tip ?? diag.description}</span>
      </div>
    </div>

    <div className="flex items-center gap-2 @lg:self-auto self-end">
      {diag.fixLabel && diag.fixAction ? (
        <Button
          className="h-7 text-caption"
          onClick={diag.fixAction}
          size="sm"
          type="button"
          variant="outline"
        >
          {diag.fixLabel}
        </Button>
      ) : null}

      <Badge
        className="font-mono text-[10px] uppercase"
        variant={DIAG_BADGE_VARIANT[diag.status] ?? "secondary"}
      >
        {diag.status}
      </Badge>
    </div>
  </div>
);

export const PreFlightDiagnosticMatrix = ({
  vitals,
  diagnostics: backendDiagnostics,
  isProbing,
  onRefresh,
  onRebootBootloader,
  isFastbootMode,
}: PreFlightDiagnosticMatrixProps) => {
  const hasDevice = vitals.serial !== null;
  const isUnlocked = vitals.lockState === "UNLOCKED";

  const diagnostics: DiagnosticItem[] =
    backendDiagnostics && backendDiagnostics.length > 0
      ? backendDiagnostics.map((d) => ({
          ...d,
          fixAction:
            d.fixLabel === "Reboot Bootloader" || d.id === "device-state"
              ? onRebootBootloader
              : undefined,
        }))
      : buildDefaultDiagnostics(vitals, isFastbootMode, hasDevice, isUnlocked, onRebootBootloader);
  return (
    <Card className="flex h-full flex-col justify-between rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-foreground text-title">
            <ShieldCheck className="size-5 text-muted-foreground" />
            Pre-Flight Diagnostic Matrix
          </CardTitle>
          <CardDescription className="text-caption">
            6-point hardware safety validation before executing partition write operations.
          </CardDescription>
        </div>

        <Button
          aria-label="Re-run diagnostics"
          className="h-8 gap-1.5 px-3 text-caption"
          disabled={isProbing || !hasDevice}
          onClick={onRefresh}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn("size-3.5", isProbing && "animate-spin")}
            data-icon="inline-start"
          />
          Re-Check
        </Button>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-2.5">
        {diagnostics.map((diag) => (
          <DiagnosticRow diag={diag} key={diag.id} />
        ))}
      </CardContent>
    </Card>
  );
};
