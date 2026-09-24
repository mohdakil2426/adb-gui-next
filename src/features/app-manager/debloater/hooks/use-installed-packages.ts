/* eslint-disable react/todo -- non-React-Compiler try/finally flow */
import { Cause, Effect, Exit, Fiber } from "effect";
import { useCallback, useEffect, useRef } from "react";

import { GetInstalledPackagesEffect } from "@/desktop/effect";
import { useInstallationStore } from "@/features/app-manager/debloater/model/installation-store";
import { useDeviceStore } from "@/shared/stores/device-store";
import { handleError } from "@/shared/utils/error-handler";

export interface InstalledPackagesController {
  /** Why the last load failed, or `null`. `hasLoaded` alone cannot tell the two apart. */
  error: string | null;
  /** `true` once a load for the current serial has settled (success or failure). */
  hasLoaded: boolean;
  isLoading: boolean;
  refresh: () => void;
  selectedSerial: string | null;
}

/**
 * Owns "which device's package list is in the store".
 *
 * This used to live inside the install tab, so the list only loaded once that
 * tab was mounted and the view-level composition summary had nothing to show.
 * Mount it **once** per view — two callers would double the `pm list` round-trip.
 */
export const useInstalledPackages = (): InstalledPackagesController => {
  const selectedSerial = useDeviceStore((s) => s.selectedSerial);
  const isLoading = useInstallationStore((s) => s.isLoadingPackages);
  const loadedSerial = useInstallationStore((s) => s.loadedSerial);
  const setPackages = useInstallationStore((s) => s.setPackages);
  const setIsLoadingPackages = useInstallationStore((s) => s.setIsLoadingPackages);
  const setLoadedSerial = useInstallationStore((s) => s.setLoadedSerial);
  const setSelectedPackages = useInstallationStore((s) => s.setSelectedPackages);
  const packagesError = useInstallationStore((s) => s.packagesError);
  const setPackagesError = useInstallationStore((s) => s.setPackagesError);
  const activeFiberRef = useRef<Fiber.Fiber<void, unknown> | null>(null);

  const load = useCallback(() => {
    if (activeFiberRef.current) {
      Effect.runFork(Fiber.interrupt(activeFiberRef.current));
      activeFiberRef.current = null;
    }

    if (!selectedSerial) {
      setPackages([]);
      setPackagesError(null);
      setLoadedSerial(null);
      setIsLoadingPackages(false);
      return;
    }

    setIsLoadingPackages(true);

    let fiber: Fiber.Fiber<void, unknown> | null = null;
    const program = Effect.gen(function* loadPackages() {
      const exit = yield* Effect.exit(GetInstalledPackagesEffect(selectedSerial));
      if (Exit.isSuccess(exit)) {
        setPackages(exit.value ?? []);
        setPackagesError(null);
      } else {
        if (Cause.hasInterrupts(exit.cause)) {
          return;
        }
        const error = Cause.squash(exit.cause);
        handleError("Load Packages", error);
        setPackages([]);
        const msg = error instanceof Error ? error.message : String(error);
        setPackagesError(msg);
      }
      setLoadedSerial(selectedSerial);
      setIsLoadingPackages(false);
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          if (activeFiberRef.current === fiber) {
            activeFiberRef.current = null;
          }
        })
      )
    );

    fiber = Effect.runFork(program);
    activeFiberRef.current = fiber;
  }, [selectedSerial, setIsLoadingPackages, setLoadedSerial, setPackages, setPackagesError]);

  useEffect(() => {
    // Reload when the selected device changes — not when the list is merely empty.
    if (selectedSerial !== loadedSerial) {
      setSelectedPackages(new Set());
      load();
    }
  }, [load, loadedSerial, selectedSerial, setSelectedPackages]);

  useEffect(
    () => () => {
      if (activeFiberRef.current) {
        Effect.runFork(Fiber.interrupt(activeFiberRef.current));
        activeFiberRef.current = null;
      }
    },
    []
  );

  const refresh = useCallback(() => {
    load();
  }, [load]);
  return {
    error: packagesError,
    hasLoaded: selectedSerial !== null && selectedSerial === loadedSerial,
    isLoading,
    refresh,
    selectedSerial,
  };
};
