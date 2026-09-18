import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ViewEmulatorManager } from "@/features/emulator/emulator-view";
import { useEmulatorManagerStore } from "@/features/emulator/model/emulator-manager-store";

const fetchAvdsMock = vi.fn<() => Promise<unknown>>();
const getAvdRestorePlanMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock(import("@/shared/utils/queries"), () => ({
  STALE_TIME: { EMULATOR_LIST: 30_000 },
  fetchAvds: () => fetchAvdsMock(),
  invalidateAvds: vi.fn<() => void>(),
  queryKeys: { avds: () => ["avds"] },
}));

vi.mock(import("@/desktop/backend"), () => ({
  EmulatorGetAvdSpecs: vi.fn<() => Promise<unknown>>().mockResolvedValue(null),
  EmulatorGetDiskBreakdown: vi.fn<() => Promise<unknown>>().mockResolvedValue(null),
  FinalizeAvdRoot: vi.fn<() => Promise<unknown>>(),
  GetAvdRestorePlan: (...args: unknown[]) => getAvdRestorePlanMock(...args),
  GetHostHardwareCapacity: vi.fn<() => Promise<unknown>>().mockResolvedValue({
    availableRamMb: 8192,
    logicalCores: 8,
    physicalCores: 4,
    totalRamMb: 16_384,
  }),
  LaunchAvd: vi.fn<() => Promise<unknown>>(),
  OpenFolder: vi.fn<() => Promise<unknown>>(),
  PrepareAvdRoot: vi.fn<() => Promise<unknown>>(),
  RestoreAvdBackups: vi.fn<() => Promise<unknown>>(),
  SelectRootPackageFile: vi.fn<() => Promise<unknown>>(),
  StopAvd: vi.fn<() => Promise<unknown>>(),
}));

const renderWithQueryClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ViewEmulatorManager />
    </QueryClientProvider>
  );
};

describe(ViewEmulatorManager, () => {
  beforeEach(() => {
    fetchAvdsMock.mockReset();
    getAvdRestorePlanMock.mockReset();
    useEmulatorManagerStore.getState().reset();
  });

  it("renders the page heading and empty state when no AVDs are present", async () => {
    fetchAvdsMock.mockResolvedValue([]);

    renderWithQueryClient();

    await expect(
      screen.findByRole("heading", {
        hidden: true,
        name: "Emulator Manager",
      })
    ).resolves.toBeInTheDocument();
    await expect(screen.findByText("No Virtual Device Selected")).resolves.toBeInTheDocument();
    await expect(
      screen.findByText("No Android Virtual Devices Found")
    ).resolves.toBeInTheDocument();
  });

  it("renders the selected avd when discovery returns data", async () => {
    fetchAvdsMock.mockResolvedValue([
      {
        abi: "x86_64",
        apiLevel: 34,
        avdPath: "C:/Users/test/.android/avd/Pixel_8_API_34.avd",
        deviceName: "pixel_8",
        hasBackups: false,
        iniPath: "C:/Users/test/.android/avd/Pixel_8_API_34.ini",
        isRunning: false,
        name: "Pixel_8_API_34",
        ramdiskPath: "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img",
        rootState: "stock",
        serial: null,
        target: "Google Play API 34",
        warnings: ["Ramdisk backup has not been created yet."],
      },
    ]);
    getAvdRestorePlanMock.mockResolvedValue({
      createdAt: "0",
      entries: [],
      source: "Pixel_8_API_34",
    });

    renderWithQueryClient();

    const elements = await screen.findAllByText("Pixel_8_API_34");
    expect(elements.length).toBeGreaterThan(0);
    await expect(screen.findByText("STOPPED")).resolves.toBeInTheDocument();
    await expect(
      screen.findByRole("button", { name: /launch avd/iu })
    ).resolves.toBeInTheDocument();
  });
});
