import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppManagerView } from "@/features/app-manager/app-manager-view";
import { useDeviceStore } from "@/shared/stores/device-store";

const getInstalledPackagesMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const getDebloatPackagesMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const loadDebloatListsMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const getDebloatDeviceSettingsMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const listDebloatBackupsMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock(import("@tanstack/react-virtual"), () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 48,
    getVirtualItems: () => [
      {
        index: 0,
        key: "com.example.camera",
        size: 48,
        start: 0,
      },
    ],
  }),
}));

vi.mock(import("@/desktop/backend"), () => ({
  DebloatPackages: vi.fn<() => Promise<unknown>>(),
  GetAppIcons: vi.fn<() => Promise<unknown>>().mockResolvedValue([]),
  GetDebloatDeviceSettings: () => getDebloatDeviceSettingsMock(),
  GetDebloatPackages: () => getDebloatPackagesMock(),
  GetInstalledPackages: (serial?: string | null) => getInstalledPackagesMock(serial),
  InstallPackage: vi.fn<() => Promise<unknown>>(),
  ListDebloatBackups: () => listDebloatBackupsMock(),
  LoadDebloatLists: () => loadDebloatListsMock(),
  SaveDebloatDeviceSettings: vi.fn<() => Promise<unknown>>(),
  SelectMultipleApkFiles: vi.fn<() => Promise<unknown>>(),
  UninstallPackage: vi.fn<() => Promise<unknown>>(),
}));

vi.mock(import("@/desktop/runtime"), () => ({
  OnFileDrop: vi.fn<() => () => void>(() => () => {}),
  OnFileDropOff: vi.fn<() => void>(),
}));

describe("ViewAppManager", () => {
  beforeEach(() => {
    useDeviceStore.getState().reset();
    useDeviceStore.getState().setDevices([{ serial: "device-a", status: "device" }]);
    getInstalledPackagesMock.mockReset();
    getDebloatPackagesMock.mockReset();
    loadDebloatListsMock.mockReset();
    getDebloatDeviceSettingsMock.mockReset();
    listDebloatBackupsMock.mockReset();
    getDebloatPackagesMock.mockResolvedValue([]);
    loadDebloatListsMock.mockResolvedValue({
      lastUpdated: "2026-01-01T00:00:00Z",
      source: "bundled",
      totalEntries: 0,
    });
    getDebloatDeviceSettingsMock.mockResolvedValue({
      deviceId: "",
      disableMode: false,
      expertMode: false,
      multiUserMode: false,
    });
    listDebloatBackupsMock.mockResolvedValue([]);
  });

  it("renders installed packages in the virtual list", async () => {
    const user = userEvent.setup();
    getInstalledPackagesMock.mockResolvedValue([
      {
        label: "Camera",
        name: "com.example.camera",
        packageType: "user",
      },
    ]);

    render(<AppManagerView activeView="apps" />);

    await user.click(screen.getByRole("tab", { name: /installed apps/iu }));

    await expect(screen.findByText("com.example.camera")).resolves.toBeInTheDocument();
    await expect(screen.findByText("Camera")).resolves.toBeInTheDocument();
    expect(
      screen.getByText("com.example.camera").closest('[role="treeitem"], [role="option"]')
    ).toBeInTheDocument();
    expect(getInstalledPackagesMock).toHaveBeenCalledWith("device-a");
  });
});
