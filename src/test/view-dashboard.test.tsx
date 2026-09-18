import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { backend } from "@/desktop/models";
import { ViewDashboard } from "@/features/dashboard/dashboard-view";
import { useMemoryHistoryStore } from "@/features/dashboard/model/memory-history-store";
import { useDeviceStore } from "@/shared/stores/device-store";

const { GetDeviceTelemetry, GetAppOverviewTelemetry } = vi.hoisted(() => ({
  GetAppOverviewTelemetry: vi.fn<() => Promise<unknown>>(),
  GetDeviceTelemetry: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock(import("@/desktop/backend"), () => ({
  ConnectWirelessAdb: vi.fn<() => Promise<unknown>>(),
  DisconnectWirelessAdb: vi.fn<() => Promise<unknown>>(),
  EnableWirelessAdb: vi.fn<() => Promise<unknown>>(),
  GetAppOverviewTelemetry,
  GetDeviceTelemetry,
  Reboot: vi.fn<() => Promise<unknown>>(),
}));

vi.mock(import("@/desktop/runtime"), () => ({
  BrowserOpenURL: vi.fn<(url: string) => Promise<unknown>>(),
}));

const GIB = 1024 ** 3;

const telemetry: backend.DeviceTelemetry = {
  battery: {
    health: "Good",
    isCharging: true,
    levelPct: 87,
    status: "Charging",
    temperatureC: 32.4,
    voltageMv: 4102,
  },
  identity: {
    androidVersion: "15",
    arch: "arm64-v8a",
    brand: "Google",
    buildId: "UQ1A.240205.004",
    codename: "panther",
    deviceName: "Pixel 7",
    fingerprint: null,
    hardware: null,
    incremental: null,
    kernelVersion: "5.10.198-android12-9-00048",
    locale: null,
    manufacturer: null,
    model: "Pixel 7",
    radio: null,
    sdkInt: 34,
    serial: "1A2B3C4D",
    timezone: null,
  },
  memory: { availableBytes: 2 * GIB, totalBytes: 8 * GIB, usedBytes: 6 * GIB },
  network: { ipAddress: "192.168.1.14", macAddress: null, wifiSsid: "home" },
  security: {
    bootloaderUnlocked: true,
    encryptionState: "file",
    rooted: false,
    securityPatch: "2026-06-05",
    selinuxEnforcing: true,
    verifiedBootState: "green",
  },
  storage: [
    {
      freeBytes: 16 * GIB,
      mount: "/data",
      rawMount: "/data",
      totalBytes: 64 * GIB,
      usedBytes: 48 * GIB,
    },
  ],
  uptimeSeconds: 273_600,
};

const renderDashboard = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ViewDashboard activeView="dashboard" />
    </QueryClientProvider>
  );
};

describe(ViewDashboard, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeviceStore.getState().reset();
    useMemoryHistoryStore.setState({ samplesBySerial: {} });
    GetDeviceTelemetry.mockResolvedValue(telemetry);
    GetAppOverviewTelemetry.mockResolvedValue({
      disabledAppsCount: 3,
      permissionDensity: [],
      storageBreakdown: [],
      systemAppsCount: 212,
      targetSdkDistribution: {
        legacy: 4,
        maxApi: 34,
        minApi: 21,
        modern: 96,
        standard: 115,
      },
      totalStorageBytes: 12 * GIB,
      userAppsCount: 96,
    });
  });

  it("walks through USB setup steps when no device is connected", () => {
    renderDashboard();

    expect(screen.getByText("No device connected")).toBeInTheDocument();
    expect(screen.getByText("Enable Developer options")).toBeInTheDocument();
    expect(screen.getByText("Turn on USB debugging")).toBeInTheDocument();
    expect(screen.getByText("Accept the RSA prompt")).toBeInTheDocument();
  });

  it("shows watching state and scan button when no device is connected", () => {
    renderDashboard();

    expect(screen.getByText("Watching for devices…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /scan again/iu })).toBeInTheDocument();
    expect(GetDeviceTelemetry).not.toHaveBeenCalled();
  });

  it("reveals the wireless pairing form from the onboarding screen", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole("button", { name: /connect wirelessly/iu }));

    expect(screen.getByLabelText("Device IP address")).toBeInTheDocument();
    expect(screen.getByLabelText("Port")).toBeInTheDocument();
  });

  it("loads telemetry automatically once a device is selected", async () => {
    useDeviceStore.setState({
      devices: [{ serial: "1A2B3C4D", status: "device" }],
      selectedSerial: "1A2B3C4D",
    });

    renderDashboard();

    await expect(screen.findByText("87%")).resolves.toBeInTheDocument();
    expect(GetDeviceTelemetry).toHaveBeenCalledWith("1A2B3C4D");
    expect(screen.getByText("Unlocked")).toBeInTheDocument();
    expect(screen.getByText("3d 4h")).toBeInTheDocument();
  });

  it("charts storage proportion when telemetry loads", async () => {
    useDeviceStore.setState({
      devices: [{ serial: "1A2B3C4D", status: "device" }],
      selectedSerial: "1A2B3C4D",
    });

    renderDashboard();

    await expect(screen.findByText("87%")).resolves.toBeInTheDocument();
    expect(screen.getByText("Internal storage")).toBeInTheDocument();
    expect(screen.getByText("/data")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Internal storage used" })).toBeInTheDocument();
  });

  it("explains why telemetry is unavailable in fastboot", async () => {
    useDeviceStore.setState({
      devices: [{ serial: "FB1234", status: "fastboot" }],
      selectedSerial: "FB1234",
    });

    renderDashboard();

    await expect(
      screen.findByText(/Fastboot exposes no runtime telemetry/iu)
    ).resolves.toBeInTheDocument();
    expect(GetDeviceTelemetry).not.toHaveBeenCalled();
  });
});
