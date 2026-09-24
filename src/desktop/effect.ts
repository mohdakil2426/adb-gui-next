import * as core from "@tauri-apps/api/core";
import { Effect } from "effect";

import { GetDeviceTelemetry, GetInstalledPackages } from "./backend";
import {
  AdbCommandError,
  DeviceNotFoundError,
  DeviceUnauthorizedError,
  IpcInvokeError,
} from "./errors";
import type { DesktopError } from "./errors";
import type { backend } from "./models";

export const categorizeIpcError = (
  command: string,
  raw: unknown,
  serial?: string | null
): DesktopError => {
  const message = raw instanceof Error ? raw.message : String(raw);
  const lower = message.toLowerCase();

  if (
    lower.includes("device offline") ||
    lower.includes("device not found") ||
    lower.includes("no devices") ||
    lower.includes("unable to locate")
  ) {
    return new DeviceNotFoundError({ message, serial: serial ?? undefined });
  }

  if (lower.includes("unauthorized") || lower.includes("device unauthorized")) {
    return new DeviceUnauthorizedError({ message, serial: serial ?? undefined });
  }

  if (lower.includes("adb:") || lower.includes("fastboot:")) {
    return new AdbCommandError({ command, message });
  }

  return new IpcInvokeError({ command, message });
};

export const invokeEffect = <T>(
  command: string,
  args?: Record<string, unknown>,
  serial?: string | null
): Effect.Effect<T, DesktopError> =>
  Effect.tryPromise({
    catch: (raw) => categorizeIpcError(command, raw, serial),
    try: () => core.invoke<T>(command, args),
  });

export const GetAllDevicesEffect = (): Effect.Effect<backend.Device[], DesktopError> =>
  invokeEffect<backend.Device[]>("get_all_devices");

export const GetDeviceTelemetryEffect = (
  serial?: string | null
): Effect.Effect<backend.DeviceTelemetry, DesktopError> =>
  Effect.tryPromise({
    catch: (raw) => categorizeIpcError("get_device_telemetry", raw, serial),
    try: () => GetDeviceTelemetry(serial),
  });

export const GetInstalledPackagesEffect = (
  serial?: string | null
): Effect.Effect<backend.InstalledPackage[], DesktopError> =>
  Effect.tryPromise({
    catch: (raw) => categorizeIpcError("get_installed_packages", raw, serial),
    try: () => GetInstalledPackages(serial),
  });

export const ExtractPayloadEffect = (
  payloadPath: string,
  outputDir: string,
  selectedPartitions: string[],
  prefetch?: boolean,
  cancelTokenId?: string
): Effect.Effect<backend.ExtractPayloadResult, DesktopError> =>
  invokeEffect<backend.ExtractPayloadResult>("extract_payload", {
    cancelTokenId: cancelTokenId ?? null,
    outputDir,
    payloadPath,
    prefetch: prefetch ?? null,
    selectedPartitions,
  });
