/* eslint-disable vitest/prefer-strict-equal, vitest/prefer-to-be-truthy, vitest/prefer-to-be-falsy, vitest/require-mock-type-parameters, vitest/prefer-import-in-mock */
import { act, renderHook, waitFor } from "@testing-library/react";
import { Effect, Exit } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { backend } from "@/desktop/models";
import { useInstalledPackages } from "@/features/app-manager/debloater/hooks/use-installed-packages";
import { useInstallationStore } from "@/features/app-manager/debloater/model/installation-store";
import { useDeviceStore } from "@/shared/stores/device-store";

const { mockGetInstalledPackagesEffect, mockHandleError } = vi.hoisted(() => ({
  mockGetInstalledPackagesEffect: vi.fn(),
  mockHandleError: vi.fn(),
}));

vi.mock("@/desktop/effect", () => ({
  GetInstalledPackagesEffect: (serial?: string | null) => mockGetInstalledPackagesEffect(serial),
}));

vi.mock("@/shared/utils/error-handler", () => ({
  handleError: (...args: unknown[]) => mockHandleError(...args),
}));
const samplePackagesDev1: backend.InstalledPackage[] = [
  {
    label: "App One",
    name: "com.example.appone",
    packageType: "user",
  },
];

const samplePackagesDev2: backend.InstalledPackage[] = [
  {
    label: "App Two",
    name: "com.example.apptwo",
    packageType: "system",
  },
];

describe("useInstalledPackages Effect & Fiber interruption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDeviceStore.getState().reset();
    useInstallationStore.getState().resetStore();
  });

  it("loads packages successfully for selected device using Effect", async () => {
    mockGetInstalledPackagesEffect.mockReturnValue(Effect.succeed(samplePackagesDev1));
    useDeviceStore.getState().setSelectedSerial("device-1");

    const { result } = renderHook(() => useInstalledPackages());

    await waitFor(() => {
      expect(result.current.hasLoaded).toBe(true);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.selectedSerial).toBe("device-1");
    expect(useInstallationStore.getState().packages).toEqual(samplePackagesDev1);
    expect(useInstallationStore.getState().loadedSerial).toBe("device-1");
  });

  it("cooperatively interrupts in-flight fiber on rapid device switch to prevent race conditions", async () => {
    let dev1ExitedWithInterrupt = false;

    // Device 1: delayed response that tracks interruption
    mockGetInstalledPackagesEffect.mockImplementation((serial) => {
      if (serial === "device-1") {
        return Effect.sleep(60).pipe(
          Effect.as(samplePackagesDev1),
          Effect.onExit((exit) =>
            Effect.sync(() => {
              if (Exit.hasInterrupts(exit)) {
                dev1ExitedWithInterrupt = true;
              }
            })
          )
        );
      }
      if (serial === "device-2") {
        return Effect.succeed(samplePackagesDev2);
      }
      return Effect.succeed([]);
    });

    useDeviceStore.getState().setSelectedSerial("device-1");
    const { result } = renderHook(() => useInstalledPackages());

    // Before device-1 settles (60ms), switch device to device-2
    act(() => {
      useDeviceStore.getState().setSelectedSerial("device-2");
    });

    // Device-2 should settle immediately
    await waitFor(() => {
      expect(result.current.selectedSerial).toBe("device-2");
      expect(result.current.hasLoaded).toBe(true);
    });

    expect(useInstallationStore.getState().packages).toEqual(samplePackagesDev2);
    expect(useInstallationStore.getState().loadedSerial).toBe("device-2");

    await waitFor(() => {
      expect(dev1ExitedWithInterrupt).toBe(true);
    });
    expect(useInstallationStore.getState().packages).toEqual(samplePackagesDev2);
    expect(useInstallationStore.getState().loadedSerial).toBe("device-2");
  });

  it("cooperatively interrupts in-flight fiber on manual refresh", async () => {
    let firstCallInterrupted = false;
    let callCount = 0;

    mockGetInstalledPackagesEffect.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Effect.sleep(60).pipe(
          Effect.as(samplePackagesDev1),
          Effect.onExit((exit) =>
            Effect.sync(() => {
              if (Exit.hasInterrupts(exit)) {
                firstCallInterrupted = true;
              }
            })
          )
        );
      }
      return Effect.succeed(samplePackagesDev2);
    });

    useDeviceStore.getState().setSelectedSerial("device-1");
    const { result } = renderHook(() => useInstalledPackages());

    // Trigger a refresh while first call is in-flight
    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(useInstallationStore.getState().packages).toEqual(samplePackagesDev2);
    });

    expect(firstCallInterrupted).toBe(true);
  });

  it("resets packages and state when device is deselected (serial becomes null)", async () => {
    mockGetInstalledPackagesEffect.mockReturnValue(Effect.succeed(samplePackagesDev1));
    useDeviceStore.getState().setSelectedSerial("device-1");

    const { result } = renderHook(() => useInstalledPackages());

    await waitFor(() => {
      expect(result.current.hasLoaded).toBe(true);
    });

    expect(useInstallationStore.getState().packages).toEqual(samplePackagesDev1);

    act(() => {
      useDeviceStore.getState().setSelectedSerial(null);
    });

    await waitFor(() => {
      expect(result.current.selectedSerial).toBeNull();
      expect(result.current.hasLoaded).toBe(false);
    });

    expect(useInstallationStore.getState().packages).toEqual([]);
    expect(useInstallationStore.getState().loadedSerial).toBeNull();
    expect(useInstallationStore.getState().packagesError).toBeNull();
  });

  it("handles errors and sets packagesError in store", async () => {
    mockGetInstalledPackagesEffect.mockReturnValue(
      Effect.fail(new Error("ADB daemon connection failure"))
    );
    useDeviceStore.getState().setSelectedSerial("device-err");

    const { result } = renderHook(() => useInstalledPackages());

    await waitFor(() => {
      expect(result.current.hasLoaded).toBe(true);
    });

    expect(result.current.error).toBe("ADB daemon connection failure");
    expect(useInstallationStore.getState().packages).toEqual([]);
    expect(useInstallationStore.getState().loadedSerial).toBe("device-err");
    expect(mockHandleError).toHaveBeenCalledWith("Load Packages", expect.any(Error));
  });

  it("interrupts active fiber on hook unmount", async () => {
    let unmountInterrupted = false;

    mockGetInstalledPackagesEffect.mockReturnValue(
      Effect.sleep(100).pipe(
        Effect.as(samplePackagesDev1),
        Effect.onExit((exit) =>
          Effect.sync(() => {
            if (Exit.hasInterrupts(exit)) {
              unmountInterrupted = true;
            }
          })
        )
      )
    );

    useDeviceStore.getState().setSelectedSerial("device-unmount");
    const { unmount } = renderHook(() => useInstalledPackages());

    unmount();
    await waitFor(() => {
      expect(unmountInterrupted).toBe(true);
    });
  });
});
