import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { backend } from "@/desktop/models";
import { useDebloatStore } from "@/features/app-manager/debloater/model/debloat-store";
import { DebloaterTab } from "@/features/app-manager/debloater/ui/debloater-tab";
import { useDeviceStore } from "@/shared/stores/device-store";

const mockGetDebloatData = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockDebloatPackages = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockCreateDebloatBackup = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockListDebloatBackups = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockRestoreDebloatBackup = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock(import("@/desktop/backend"), () => ({
  CreateDebloatBackup: (pkgs: backend.PackageSnapshot[], serial?: string | null) =>
    mockCreateDebloatBackup(pkgs, serial),
  DebloatPackages: (
    pkgs: string[],
    action: backend.DebloatAction,
    user?: number,
    serial?: string | null
  ) => mockDebloatPackages(pkgs, action, user, serial),
  GetDebloatData: (serial?: string | null) => mockGetDebloatData(serial),
  GetDebloatDeviceSettings: vi.fn<() => Promise<unknown>>().mockResolvedValue({
    disableMode: false,
    expertMode: false,
    multiUserMode: false,
  }),
  ListDebloatBackups: (serial?: string | null) => mockListDebloatBackups(serial),
  RestoreDebloatBackup: (file: string, serial?: string | null) =>
    mockRestoreDebloatBackup(file, serial),
  SaveDebloatDeviceSettings: vi.fn<() => Promise<void>>().mockResolvedValue(),
}));

vi.mock(import("@tanstack/react-virtual"), () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 56,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: `pkg-${i}`,
        size: 56,
        start: i * 56,
      })),
  }),
}));

const samplePackages: backend.DebloatPackageRow[] = [
  {
    dependencies: [],
    description: "Samsung telemetry agent",
    list: "Oem",
    name: "com.samsung.telemetry",
    neededBy: [],
    removal: "Recommended",
    state: "Enabled",
  },
  {
    dependencies: ["com.google.gms"],
    description: "Google Maps framework",
    list: "Google",
    name: "com.google.android.apps.maps",
    neededBy: [],
    removal: "Advanced",
    state: "Enabled",
  },
  {
    dependencies: [],
    description: "Critical system service",
    list: "Aosp",
    name: "com.android.server.telecom",
    neededBy: ["com.android.phone"],
    removal: "Unsafe",
    state: "Enabled",
  },
];

describe("DebloaterTab Precision Cockpit", () => {
  beforeEach(() => {
    useDeviceStore.getState().reset();
    useDeviceStore.getState().setDevices([{ serial: "device-123", status: "device" }]);
    useDeviceStore.getState().setSelectedSerial("device-123");

    useDebloatStore.getState().resetFilters();
    useDebloatStore.getState().setPackages([]);
    useDebloatStore.getState().setBackups([]);
    useDebloatStore.getState().unselectAll();

    mockGetDebloatData.mockReset();
    mockDebloatPackages.mockReset();
    mockCreateDebloatBackup.mockReset();
    mockListDebloatBackups.mockReset();
    mockRestoreDebloatBackup.mockReset();

    mockGetDebloatData.mockResolvedValue({
      backups: [],
      listStatus: {
        lastUpdated: "2026-08-18",
        source: "remote",
        totalEntries: 3,
      },
      packages: samplePackages,
      settings: { disableMode: false, expertMode: false, multiUserMode: false },
    });
    mockListDebloatBackups.mockResolvedValue([]);
  });

  it("renders safety tier filter chips and displays live counts", async () => {
    render(<DebloaterTab />);

    await expect(screen.findByText("com.samsung.telemetry")).resolves.toBeInTheDocument();
    expect(screen.getByText("com.google.android.apps.maps")).toBeInTheDocument();

    // Check Safety tier filter chips
    expect(screen.getByRole("button", { name: /^Recommended/u })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Advanced/u })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Unsafe/u })).toBeInTheDocument();
  });

  it("filters packages when clicking safety tier chips", async () => {
    const user = userEvent.setup();
    render(<DebloaterTab />);

    await expect(screen.findByText("com.samsung.telemetry")).resolves.toBeInTheDocument();

    // Click 'Recommended' chip
    await user.click(screen.getByRole("button", { name: /^Recommended/u }));

    expect(screen.getByText("com.samsung.telemetry")).toBeInTheDocument();
    expect(screen.queryByText("com.google.android.apps.maps")).not.toBeInTheDocument();
    expect(screen.queryByText("com.android.server.telecom")).not.toBeInTheDocument();
  });

  it("triggers 1-click single-package uninstall button", async () => {
    const user = userEvent.setup();
    mockDebloatPackages.mockResolvedValue([
      {
        error: null,
        newState: "Uninstalled",
        packageName: "com.samsung.telemetry",
        success: true,
      },
    ]);

    render(<DebloaterTab />);

    await expect(screen.findByText("com.samsung.telemetry")).resolves.toBeInTheDocument();

    // Click 1-click single package "Uninstall" button
    const uninstallButtons = screen.getAllByRole("button", {
      name: /Uninstall/iu,
    });
    expect(uninstallButtons.length).toBeGreaterThan(0);

    const [firstRowUninstall] = uninstallButtons;
    expect(firstRowUninstall).toBeDefined();
    await user.click(firstRowUninstall as HTMLElement);
    expect(mockDebloatPackages).toHaveBeenCalledWith(
      ["com.samsung.telemetry"],
      "uninstall",
      0,
      "device-123"
    );
  });

  it("creates 1-click snapshot backup and updates store", async () => {
    const user = userEvent.setup();
    mockCreateDebloatBackup.mockResolvedValue({
      createdAt: "1723982400",
      deviceId: "device-123",
      fileName: "backup_20260818.json",
      packageCount: 3,
    });
    mockListDebloatBackups.mockResolvedValue([
      {
        createdAt: "1723982400",
        deviceId: "device-123",
        fileName: "backup_20260818.json",
        packageCount: 3,
      },
    ]);

    render(<DebloaterTab />);

    const telemetryMatches = await screen.findAllByText("com.samsung.telemetry");
    expect(telemetryMatches[0]).toBeInTheDocument();

    const snapshotButton = screen.getByRole("button", {
      name: /Take State Snapshot/iu,
    });
    await user.click(snapshotButton);

    expect(mockCreateDebloatBackup).toHaveBeenCalledWith(expect.any(Array), "device-123");
  });
});
