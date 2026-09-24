import { Effect } from "effect";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { backend } from "@/desktop/models";
import {
  installMarketplacePackage,
  installMarketplacePackageEffect,
} from "@/features/marketplace/utils/install";
import { useDeviceStore } from "@/shared/stores/device-store";
import { useLogStore } from "@/shared/stores/log-store";

const mockMarketplaceDownloadApk = vi.fn<(...args: unknown[]) => Promise<string>>();
const mockMarketplaceInstallApk = vi.fn<(...args: unknown[]) => Promise<string>>();

vi.mock(import("@/desktop/backend"), () => ({
  MarketplaceDownloadApk: (...args: unknown[]) => mockMarketplaceDownloadApk(...args),
  MarketplaceInstallApk: (...args: unknown[]) => mockMarketplaceInstallApk(...args),
}));

vi.mock(import("sonner"), () => ({
  toast: {
    error: vi.fn<(title: string, options?: unknown) => void>(),
    info: vi.fn<(title: string, options?: unknown) => void>(),
    loading: vi.fn<(title: string, options?: unknown) => string>(() => "test-toast-id"),
    success: vi.fn<(title: string, options?: unknown) => void>(),
  },
}));

const testDevice: backend.Device = {
  connectionType: "Usb",
  model: "Pixel 8",
  name: "Pixel 8",
  product: "husky",
  serial: "emulator-5554",
  status: "device",
};

describe(installMarketplacePackageEffect, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLogStore.getState().clearLogs();
    useDeviceStore.setState({
      deviceInfo: null,
      devices: [testDevice],
      editingDeviceSerial: null,
      isEditingNickname: false,
      lastUpdated: Date.now(),
      selectedSerial: "emulator-5554",
    });
    mockMarketplaceDownloadApk.mockResolvedValue("/tmp/test-app.apk");
    mockMarketplaceInstallApk.mockResolvedValue("Success");
  });

  it("sequences download, install, and notifications successfully", async () => {
    await Effect.runPromise(
      installMarketplacePackageEffect(
        "F-Droid",
        "https://example.com/fdroid.apk",
        "emulator-5554",
        "org.fdroid.fdroid"
      )
    );

    expect(mockMarketplaceDownloadApk).toHaveBeenCalledWith(
      "https://example.com/fdroid.apk",
      "org.fdroid.fdroid"
    );
    expect(mockMarketplaceInstallApk).toHaveBeenCalledWith("/tmp/test-app.apk", "emulator-5554");
    expect(toast.loading).toHaveBeenCalledWith("Installing F-Droid on emulator-5554…", {
      id: "test-toast-id",
    });
    expect(toast.success).toHaveBeenCalledWith("F-Droid installed", {
      description: "Target: emulator-5554",
      id: "test-toast-id",
    });
    const { logs } = useLogStore.getState();
    expect(
      logs.some((l) => l.message.includes("Installed F-Droid") && l.type === "success")
    ).toBeTruthy();
  });

  it("resolves target device automatically when serial is omitted", async () => {
    await Effect.runPromise(
      installMarketplacePackageEffect("F-Droid", "https://example.com/fdroid.apk")
    );

    expect(mockMarketplaceInstallApk).toHaveBeenCalledWith("/tmp/test-app.apk", "emulator-5554");
  });

  it("fails early and logs warning when no device is available", async () => {
    useDeviceStore.setState({
      devices: [],
      selectedSerial: null,
    });

    await expect(
      Effect.runPromise(
        installMarketplacePackageEffect("F-Droid", "https://example.com/fdroid.apk", null)
      )
    ).rejects.toThrow("No device is selected");

    expect(mockMarketplaceDownloadApk).not.toHaveBeenCalled();
    expect(mockMarketplaceInstallApk).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Cannot install F-Droid",
      expect.objectContaining({ description: expect.stringContaining("No device is selected") })
    );

    const { logs } = useLogStore.getState();
    expect(
      logs.some((l) => l.type === "warning" && l.message.includes("not installed"))
    ).toBeTruthy();
  });

  it("handles download failure cleanly with error toast and log", async () => {
    mockMarketplaceDownloadApk.mockRejectedValue(new Error("Connection timeout"));

    await expect(
      Effect.runPromise(
        installMarketplacePackageEffect(
          "F-Droid",
          "https://example.com/fdroid.apk",
          "emulator-5554"
        )
      )
    ).rejects.toThrow("Connection timeout");

    expect(mockMarketplaceInstallApk).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Failed to install F-Droid", {
      description:
        "Connection timeout — check the device is unlocked and has room, then try again.",
      id: "test-toast-id",
    });

    const { logs } = useLogStore.getState();
    expect(
      logs.some((l) => l.type === "error" && l.message.includes("Connection timeout"))
    ).toBeTruthy();
  });

  it("handles Rust string rejections without swallowing error message", async () => {
    mockMarketplaceInstallApk.mockRejectedValue("INSTALL_FAILED_INSUFFICIENT_STORAGE");

    await expect(
      Effect.runPromise(
        installMarketplacePackageEffect(
          "F-Droid",
          "https://example.com/fdroid.apk",
          "emulator-5554"
        )
      )
    ).rejects.toThrow("INSTALL_FAILED_INSUFFICIENT_STORAGE");

    expect(toast.error).toHaveBeenCalledWith("Failed to install F-Droid", {
      description:
        "INSTALL_FAILED_INSUFFICIENT_STORAGE — check the device is unlocked and has room, then try again.",
      id: "test-toast-id",
    });

    const { logs } = useLogStore.getState();
    expect(
      logs.some(
        (l) => l.type === "error" && l.message.includes("INSTALL_FAILED_INSUFFICIENT_STORAGE")
      )
    ).toBeTruthy();
  });

  it("maintains backward compatibility for installMarketplacePackage Promise caller", async () => {
    await expect(
      installMarketplacePackage("F-Droid", "https://example.com/fdroid.apk", "emulator-5554")
    ).resolves.toBeUndefined();

    expect(mockMarketplaceDownloadApk).toHaveBeenCalledWith(
      "https://example.com/fdroid.apk",
      "F-Droid"
    );
    expect(mockMarketplaceInstallApk).toHaveBeenCalledWith("/tmp/test-app.apk", "emulator-5554");
  });
});
