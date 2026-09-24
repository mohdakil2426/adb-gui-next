/* eslint-disable vitest/prefer-strict-equal, vitest/prefer-to-be-truthy, vitest/prefer-to-be-falsy */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as core from "@tauri-apps/api/core";
import { renderHook, waitFor } from "@testing-library/react";
import { Effect, Schedule } from "effect";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GetDeviceTelemetryEffect } from "@/desktop/effect";
import { DeviceNotFoundError, DeviceUnauthorizedError, IpcInvokeError } from "@/desktop/errors";
import type { backend } from "@/desktop/models";
import {
  deviceTelemetryRetrySchedule,
  telemetryQueryKey,
  useDeviceTelemetry,
} from "@/features/dashboard/hooks/use-device-telemetry";

const mockTelemetry: backend.DeviceTelemetry = {
  battery: {
    health: "Good",
    isCharging: true,
    levelPct: 90,
    status: "Charging",
    temperatureC: 28.5,
    voltageMv: 4200,
  },
  identity: {
    androidVersion: "14",
    arch: "arm64-v8a",
    brand: "Google",
    buildId: "UP1A.231005.007",
    codename: "shiba",
    deviceName: "Pixel 8",
    fingerprint: null,
    hardware: null,
    incremental: null,
    kernelVersion: "5.15.0",
    locale: null,
    manufacturer: null,
    model: "Pixel 8",
    radio: null,
    sdkInt: 34,
    serial: "test-device-123",
    timezone: null,
  },
  memory: {
    availableBytes: 4 * 1024 * 1024 * 1024,
    totalBytes: 8 * 1024 * 1024 * 1024,
    usedBytes: 4 * 1024 * 1024 * 1024,
  },
  network: {
    ipAddress: "192.168.1.50",
    macAddress: null,
    wifiSsid: "Office-5G",
  },
  security: {
    bootloaderUnlocked: false,
    encryptionState: "encrypted",
    rooted: false,
    securityPatch: "2026-01-01",
    selinuxEnforcing: true,
    verifiedBootState: "green",
  },
  storage: [
    {
      freeBytes: 64 * 1024 * 1024 * 1024,
      mount: "/data",
      rawMount: "/data",
      totalBytes: 128 * 1024 * 1024 * 1024,
      usedBytes: 64 * 1024 * 1024 * 1024,
    },
  ],
  uptimeSeconds: 120_000,
};

describe(GetDeviceTelemetryEffect, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches device telemetry over mocked IPC successfully", async () => {
    vi.mocked(core.invoke).mockResolvedValueOnce(mockTelemetry);

    const result = await Effect.runPromise(GetDeviceTelemetryEffect("test-device-123"));

    expect(core.invoke).toHaveBeenCalledWith("get_device_telemetry", {
      serial: "test-device-123",
    });
    expect(result).toEqual(mockTelemetry);
  });

  it("categorizes device offline errors into DeviceNotFoundError", async () => {
    vi.mocked(core.invoke).mockRejectedValueOnce(new Error("device offline"));

    const error = await Effect.runPromise(Effect.flip(GetDeviceTelemetryEffect("test-device-123")));

    expect(error).toBeInstanceOf(DeviceNotFoundError);
    expect(error._tag).toBe("DeviceNotFoundError");
  });

  it("categorizes device unauthorized errors into DeviceUnauthorizedError", async () => {
    vi.mocked(core.invoke).mockRejectedValueOnce(new Error("device unauthorized"));

    const error = await Effect.runPromise(Effect.flip(GetDeviceTelemetryEffect("test-device-123")));

    expect(error).toBeInstanceOf(DeviceUnauthorizedError);
    expect(error._tag).toBe("DeviceUnauthorizedError");
  });

  it("categorizes general IPC invoke failures into IpcInvokeError", async () => {
    vi.mocked(core.invoke).mockRejectedValueOnce(new Error("internal daemon failure"));

    const error = await Effect.runPromise(Effect.flip(GetDeviceTelemetryEffect("test-device-123")));

    expect(error).toBeInstanceOf(IpcInvokeError);
    expect(error._tag).toBe("IpcInvokeError");
  });
});

describe("deviceTelemetryRetrySchedule and pipeline retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries transient failures and succeeds without error", async () => {
    // Attempt 1 fails, Attempt 2 succeeds
    vi.mocked(core.invoke)
      .mockRejectedValueOnce(new Error("transient socket timeout"))
      .mockResolvedValueOnce(mockTelemetry);

    const fastRetryPolicy = Schedule.exponential("1 millis").pipe(Schedule.upTo({ times: 2 }));

    const pipeline = GetDeviceTelemetryEffect("test-device-123").pipe(
      Effect.retry(fastRetryPolicy)
    );

    const result = await Effect.runPromise(pipeline);

    expect(core.invoke).toHaveBeenCalledTimes(2);
    expect(result).toEqual(mockTelemetry);
  });

  it("retries up to 2 times before failing on persistent error", async () => {
    vi.mocked(core.invoke).mockRejectedValue(new Error("persistent adb failure"));

    const fastRetryPolicy = Schedule.exponential("1 millis").pipe(Schedule.upTo({ times: 2 }));

    const pipeline = GetDeviceTelemetryEffect("test-device-123").pipe(
      Effect.retry(fastRetryPolicy)
    );

    const error = await Effect.runPromise(Effect.flip(pipeline));

    // 1 initial attempt + 2 retries = 3 attempts total
    expect(core.invoke).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(IpcInvokeError);
  });

  it("exports a valid Effect Schedule retry policy", () => {
    expect(Schedule.isSchedule(deviceTelemetryRetrySchedule)).toBe(true);
  });

  it("preserves stable telemetry TanStack Query key format", () => {
    expect(telemetryQueryKey("device-abc")).toEqual(["deviceTelemetry", "device-abc"]);
  });
});

describe("useDeviceTelemetry hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads device telemetry successfully through TanStack query", async () => {
    vi.mocked(core.invoke).mockResolvedValue(mockTelemetry);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: 0, retry: false } },
    });

    const { result } = renderHook(() => useDeviceTelemetry("test-device-123", true), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    });

    await waitFor(() => {
      expect(result.current.telemetry).toEqual(mockTelemetry);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("recovers from transient glitch via Effect retry inside queryFn", async () => {
    // Attempt 1 fails, Attempt 2 succeeds
    vi.mocked(core.invoke)
      .mockRejectedValueOnce(new Error("transient glitch"))
      .mockResolvedValueOnce(mockTelemetry);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: 0, retry: false } },
    });

    const { result } = renderHook(() => useDeviceTelemetry("test-device-123", true), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children),
    });

    await waitFor(
      () => {
        expect(result.current.telemetry).toEqual(mockTelemetry);
      },
      { timeout: 3000 }
    );

    expect(result.current.error).toBeNull();
    expect(core.invoke).toHaveBeenCalledTimes(2);
  });
});
