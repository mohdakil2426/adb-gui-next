import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ViewUtilities } from "@/features/utilities/utilities-view";

vi.mock(import("@/features/utilities/hooks/use-utility-actions"), () => ({
  useUtilityActions: () => ({
    deviceMode: "adb",
    deviceSerial: "SERIAL123",
    getVarContent: "",
    handleFastbootGetVars: vi.fn<() => void>(),
    handleKillServer: vi.fn<() => void>(),
    handleReboot: vi.fn<(action: string) => void>(),
    handleRestartServer: vi.fn<() => void>(),
    handleSaveGetVars: vi.fn<() => void>(),
    handleSetActiveSlot: vi.fn<(slot: string) => void>(),
    handleWipeData: vi.fn<() => void>(),
    isEditing: false,
    isGlobalLoading: false,
    loadingAction: null,
    refetchDevices: vi.fn<() => void>(),
    sentAction: null,
    setIsEditing: vi.fn<(editing: boolean) => void>(),
    setShowGetVarDialog: vi.fn<(show: boolean) => void>(),
    showGetVarDialog: false,
  }),
}));

vi.mock(import("@/shared/components/edit-nickname-dialog"), () => ({
  EditNicknameDialog: () => null,
}));

vi.mock(import("@/desktop/runtime"), () => ({
  EventsOn: vi.fn<() => () => void>().mockReturnValue(vi.fn<() => void>()),
}));

vi.mock(import("@/desktop/backend"), () => ({
  GetDeviceTelemetry: vi.fn<() => Promise<unknown>>().mockResolvedValue(null),
  GetHostToolVersions: vi.fn<() => Promise<unknown>>().mockResolvedValue({
    adb: "Android Debug Bridge version 1.0.41",
    fastboot: "fastboot version 36.0.0",
  }),
  GetLogcatSnapshot: vi.fn<() => Promise<unknown>>(),
  HostSetupInstall: vi.fn<() => Promise<unknown>>(),
  HostSetupInstallDriver: vi.fn<() => Promise<unknown>>(),
  HostSetupRepairPath: vi.fn<() => Promise<unknown>>(),
  HostSetupStatus: vi.fn<() => Promise<unknown>>().mockResolvedValue({
    adbPresent: false,
    driverInstalled: false,
    driverLabel: "Not installed",
    installPath: "C:\\Android\\platform-tools",
    latestPlatformTools: "36.0.0",
    latestUsbDriver: "13",
    onPath: false,
  }),
  LaunchDeviceManager: vi.fn<() => Promise<unknown>>(),
  LaunchHostSetupTerminal: vi.fn<() => Promise<unknown>>(),
  OpenFolder: vi.fn<() => Promise<unknown>>(),
  RunAdbHostCommand: vi.fn<() => Promise<unknown>>(),
  RunShellCommand: vi.fn<() => Promise<unknown>>(),
  SaveLog: vi.fn<() => Promise<unknown>>(),
  SaveScreenshot: vi.fn<() => Promise<unknown>>(),
  SelectScreenshotPng: vi.fn<() => Promise<unknown>>(),
}));

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe(ViewUtilities, () => {
  it("renders heading and navigation tab triggers", () => {
    render(<ViewUtilities />, { wrapper });

    expect(screen.getByRole("heading", { hidden: true, name: "Utilities" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /overview/iu })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /power & tweaks/iu })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /diagnostics/iu })).toBeInTheDocument();
  });

  it("renders fastboot and host setup tab triggers with default overview selection", () => {
    render(<ViewUtilities />, { wrapper });

    expect(screen.getByRole("tab", { name: /fastboot/iu })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /host setup/iu })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /overview/iu, selected: true })).toBeInTheDocument();
    expect(screen.getByText("Instant Action Command Cockpit")).toBeInTheDocument();
  });

  it("navigates across power, fastboot, and host setup tabs", async () => {
    const user = userEvent.setup();
    render(<ViewUtilities />, { wrapper });

    await user.click(screen.getByRole("tab", { name: /power & tweaks/iu }));
    expect(screen.getByText("Target Reboot Actions")).toBeInTheDocument();
    expect(screen.getByText("Android System Tweaks")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /fastboot/iu }));
    expect(screen.getByText(/Bootloader Slot Controls/iu)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /host setup/iu }));
    expect(screen.getByText("Host ADB Server Controls")).toBeInTheDocument();
  });
});
