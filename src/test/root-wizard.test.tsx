import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { backend } from "@/desktop/models";
import { useEmulatorManagerStore } from "@/features/emulator/model/emulator-manager-store";
import { RootWizard } from "@/features/emulator/ui/root-wizard";

const scanAvdRootReadinessMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const rootAvdMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const prepareAvdRootMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const finalizeAvdRootMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const verifyAvdRootMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const selectRootPackageFileMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const selectPatchedRootImageFileMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const onFileDropMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const onFileDropOffMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock(import("@/desktop/runtime"), () => ({
  EventsOn: vi.fn<() => () => void>().mockReturnValue(vi.fn<() => void>()),
  OnFileDrop: (...args: unknown[]) => onFileDropMock(...args),
  OnFileDropOff: (...args: unknown[]) => onFileDropOffMock(...args),
}));

vi.mock(import("@/desktop/backend"), () => ({
  FetchMagiskStableRelease: vi.fn<() => Promise<unknown>>().mockResolvedValue({
    assetName: "Magisk-v30.7.apk",
    downloadUrl: "https://example.test/Magisk-v30.7.apk",
    publishedAt: "2026-04-01T00:00:00Z",
    sha256: null,
    size: 1234,
    tag: "v30.7",
    version: "30.7",
  }),
  FinalizeAvdRoot: (...args: unknown[]) => finalizeAvdRootMock(...args),
  LaunchAvd: vi.fn<() => Promise<unknown>>(),
  PrepareAvdRoot: (...args: unknown[]) => prepareAvdRootMock(...args),
  RootAvd: (...args: unknown[]) => rootAvdMock(...args),
  ScanAvdRootReadiness: (...args: unknown[]) => scanAvdRootReadinessMock(...args),
  SelectPatchedRootImageFile: (...args: unknown[]) => selectPatchedRootImageFileMock(...args),
  SelectRootPackageFile: (...args: unknown[]) => selectRootPackageFileMock(...args),
  StopAvd: vi.fn<() => Promise<unknown>>(),
  VerifyAvdRoot: (...args: unknown[]) => verifyAvdRootMock(...args),
}));

vi.mock(import("sonner"), () => ({
  toast: {
    error: vi.fn<() => void>(),
    info: vi.fn<() => void>(),
    success: vi.fn<() => void>(),
  },
}));

const runningAvd: backend.AvdSummary = {
  abi: "x86_64",
  apiLevel: 34,
  avdPath: "C:/Users/test/.android/avd/Pixel_8_API_34.avd",
  bootMode: "cold",
  deviceName: "pixel_8",
  hasBackups: false,
  iniPath: "C:/Users/test/.android/avd/Pixel_8_API_34.ini",
  isRunning: true,
  name: "Pixel_8_API_34",
  ramdiskPath: "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img",
  rootState: "stock",
  serial: "emulator-5554",
  target: "Google Play",
  warnings: [],
};

describe(RootWizard, () => {
  beforeEach(() => {
    scanAvdRootReadinessMock.mockReset();
    rootAvdMock.mockReset();
    prepareAvdRootMock.mockReset();
    finalizeAvdRootMock.mockReset();
    verifyAvdRootMock.mockReset();
    selectRootPackageFileMock.mockReset();
    selectPatchedRootImageFileMock.mockReset();
    onFileDropMock.mockReset();
    onFileDropOffMock.mockReset();
    useEmulatorManagerStore.getState().reset();
  });

  it("triggers preflight scan when clicking Start Preflight Scan button and allows rescan", async () => {
    scanAvdRootReadinessMock.mockRejectedValueOnce(new Error("adb offline"));

    render(<RootWizard avd={runningAvd} />);

    // Scan has not run yet
    expect(scanAvdRootReadinessMock).not.toHaveBeenCalled();

    // Click Start Preflight Scan
    await userEvent.click(await screen.findByRole("button", { name: /start preflight scan/iu }));
    expect(scanAvdRootReadinessMock).toHaveBeenCalledOnce();

    // Mock successful rescan
    scanAvdRootReadinessMock.mockResolvedValueOnce({
      canProceed: true,
      checks: [],
      hasWarnings: false,
      recommendedAction: null,
    });

    // We should be able to trigger rescan if it failed (it stays on preflight page)
    await userEvent.click(await screen.findByRole("button", { name: /start preflight scan/iu }));
    expect(scanAvdRootReadinessMock).toHaveBeenCalledTimes(2);
  });

  it("shows patch-installed state instead of root success after patching", async () => {
    scanAvdRootReadinessMock.mockResolvedValue({
      canProceed: true,
      checks: [],
      hasWarnings: false,
      recommendedAction: null,
    });
    rootAvdMock.mockResolvedValue({
      activationStatus: "patchInstalled",
      magiskVersion: "30.7",
      managerInstalled: true,
      message: "Patched ramdisk installed. Cold boot the emulator, then run verification.",
      patchedRamdiskPath:
        "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img",
    });

    render(<RootWizard avd={runningAvd} />);

    await userEvent.click(await screen.findByRole("button", { name: /start preflight scan/iu }));
    await userEvent.click(await screen.findByRole("button", { name: /continue to setup/iu }));
    await userEvent.click(await screen.findByRole("button", { name: /start automated root/iu }));

    await expect(screen.findByText("Patch Installed")).resolves.toBeInTheDocument();
    expect(screen.queryByText("Root Successful!")).not.toBeInTheDocument();
  });

  it("verifies root after patch installation before showing verified success", async () => {
    scanAvdRootReadinessMock.mockResolvedValue({
      canProceed: true,
      checks: [],
      hasWarnings: false,
      recommendedAction: null,
    });
    rootAvdMock.mockResolvedValue({
      activationStatus: "patchInstalled",
      magiskVersion: "30.7",
      managerInstalled: true,
      message: "Patched ramdisk installed. Cold boot the emulator, then run verification.",
      patchedRamdiskPath:
        "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img",
    });
    verifyAvdRootMock.mockResolvedValue({
      bootCompleted: true,
      magiskPackage: "com.topjohnwu.magisk",
      message: "Root verified: su returned uid 0.",
      status: "verified",
      suUid: "0",
    });

    render(<RootWizard avd={runningAvd} />);

    await userEvent.click(await screen.findByRole("button", { name: /start preflight scan/iu }));
    await userEvent.click(await screen.findByRole("button", { name: /continue to setup/iu }));
    await userEvent.click(await screen.findByRole("button", { name: /start automated root/iu }));
    await userEvent.click(await screen.findByRole("button", { name: /verify root/iu }));

    await expect(screen.findByText("Root Verified")).resolves.toBeInTheDocument();
    expect(verifyAvdRootMock).toHaveBeenCalledWith(runningAvd.name, runningAvd.serial);
  });

  it("exposes the FAKEBOOTIMG manual flow and finalizes a patched fake boot image", async () => {
    scanAvdRootReadinessMock.mockResolvedValue({
      canProceed: true,
      checks: [],
      hasWarnings: false,
      recommendedAction: null,
    });
    selectRootPackageFileMock.mockResolvedValue("C:/Downloads/Magisk-v30.0.apk");
    prepareAvdRootMock.mockResolvedValue({
      fakeBootRemotePath: "/sdcard/Download/fakeboot.img",
      instructions: ["Open Magisk", "Patch /sdcard/Download/fakeboot.img", "Return and finalize"],
      normalizedPackagePath: "C:/Downloads/Magisk-v30.0.apk",
    });
    finalizeAvdRootMock.mockResolvedValue({
      nextBootRecommendation: "Cold boot the emulator.",
      restoredFiles: ["C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img"],
    });

    render(<RootWizard avd={runningAvd} />);

    await userEvent.click(await screen.findByRole("button", { name: /start preflight scan/iu }));
    await userEvent.click(await screen.findByRole("button", { name: /continue to setup/iu }));
    await userEvent.click(await screen.findByRole("tab", { name: /manual fakebootimg/iu }));
    await expect(screen.findByText("Manual FAKEBOOTIMG Mode")).resolves.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /choose magisk package/iu }));
    await userEvent.click(screen.getByRole("button", { name: /create fakeboot/iu }));

    expect(prepareAvdRootMock).toHaveBeenCalledWith({
      avdName: runningAvd.name,
      rootPackagePath: "C:/Downloads/Magisk-v30.0.apk",
      serial: runningAvd.serial,
    });
    await expect(screen.findByText("/sdcard/Download/fakeboot.img")).resolves.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /finalize root/iu }));

    expect(finalizeAvdRootMock).toHaveBeenCalledWith({
      avdName: runningAvd.name,
      serial: runningAvd.serial,
    });
    await expect(screen.findByText("Patch Installed")).resolves.toBeInTheDocument();
  });

  it("finalizes manual root with a user-selected local patched image", async () => {
    scanAvdRootReadinessMock.mockResolvedValue({
      canProceed: true,
      checks: [],
      hasWarnings: false,
      recommendedAction: null,
    });
    selectRootPackageFileMock.mockResolvedValue("C:/Downloads/Magisk-v30.0.apk");
    selectPatchedRootImageFileMock.mockResolvedValue("C:/Downloads/magisk_patched-123.img");
    prepareAvdRootMock.mockResolvedValue({
      fakeBootRemotePath: "/sdcard/Download/fakeboot.img",
      instructions: ["Open Magisk", "Patch /sdcard/Download/fakeboot.img", "Return and finalize"],
      normalizedPackagePath: "C:/Downloads/Magisk-v30.0.apk",
    });
    finalizeAvdRootMock.mockResolvedValue({
      nextBootRecommendation: "Cold boot the emulator.",
      restoredFiles: [
        "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img",
        "C:/Downloads/magisk_patched-123.img",
      ],
    });

    render(<RootWizard avd={runningAvd} />);

    await userEvent.click(await screen.findByRole("button", { name: /start preflight scan/iu }));
    await userEvent.click(await screen.findByRole("button", { name: /continue to setup/iu }));
    await userEvent.click(await screen.findByRole("tab", { name: /manual fakebootimg/iu }));
    await userEvent.click(screen.getByRole("button", { name: /choose magisk package/iu }));
    await userEvent.click(screen.getByRole("button", { name: /create fakeboot/iu }));
    await screen.findByText("/sdcard/Download/fakeboot.img");

    await userEvent.click(screen.getByRole("button", { name: /select patched image/iu }));
    await expect(
      screen.findByText("C:/Downloads/magisk_patched-123.img")
    ).resolves.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /finalize root/iu }));

    expect(finalizeAvdRootMock).toHaveBeenCalledWith({
      avdName: runningAvd.name,
      patchedImagePath: "C:/Downloads/magisk_patched-123.img",
      serial: runningAvd.serial,
    });
  });

  it("finalizes manual root with a dropped local patched image", async () => {
    scanAvdRootReadinessMock.mockResolvedValue({
      canProceed: true,
      checks: [],
      hasWarnings: false,
      recommendedAction: null,
    });
    selectRootPackageFileMock.mockResolvedValue("C:/Downloads/Magisk-v30.0.apk");
    prepareAvdRootMock.mockResolvedValue({
      fakeBootRemotePath: "/sdcard/Download/fakeboot.img",
      instructions: ["Open Magisk", "Patch /sdcard/Download/fakeboot.img", "Return and finalize"],
      normalizedPackagePath: "C:/Downloads/Magisk-v30.0.apk",
    });
    finalizeAvdRootMock.mockResolvedValue({
      nextBootRecommendation: "Cold boot the emulator.",
      restoredFiles: [
        "C:/Sdk/system-images/android-34/google_apis_playstore/x86_64/ramdisk.img",
        "C:/Downloads/magisk_patched-dropped.img",
      ],
    });

    render(<RootWizard avd={runningAvd} />);

    await userEvent.click(await screen.findByRole("button", { name: /start preflight scan/iu }));
    await userEvent.click(await screen.findByRole("button", { name: /continue to setup/iu }));
    await userEvent.click(await screen.findByRole("tab", { name: /manual fakebootimg/iu }));
    await userEvent.click(screen.getByRole("button", { name: /choose magisk package/iu }));
    await userEvent.click(screen.getByRole("button", { name: /create fakeboot/iu }));
    await screen.findByText("/sdcard/Download/fakeboot.img");

    const dropCalls = onFileDropMock.mock.calls;
    const handler = dropCalls.at(-1)?.[0] as
      | { onDrop: (paths: string[], x: number, y: number) => void }
      | undefined;
    expect(handler).toBeDefined();
    act(() => {
      handler?.onDrop(["C:/Downloads/magisk_patched-dropped.img"], 0, 0);
    });

    await expect(
      screen.findByText("C:/Downloads/magisk_patched-dropped.img")
    ).resolves.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /finalize root/iu }));

    expect(finalizeAvdRootMock).toHaveBeenCalledWith({
      avdName: runningAvd.name,
      patchedImagePath: "C:/Downloads/magisk_patched-dropped.img",
      serial: runningAvd.serial,
    });
  });
});
