import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { backend } from "@/desktop/models";
import { useMemoryHistoryStore } from "@/features/dashboard/model/memory-history-store";

type Device = backend.Device;
type DeviceInfo = backend.DeviceInfo;

interface DeviceState {
  deviceInfo: DeviceInfo | null;
  // ── Device Data ────────────────────────────────────────────────────────────
  devices: Device[];
  editingDeviceSerial: string | null;

  // ── UI State (for persistence) ──────────────────────────────────────────────
  isEditingNickname: boolean;
  lastUpdated: number;
  reset: () => void;
  selectedSerial: string | null;
  setDeviceInfo: (info: DeviceInfo | null) => void;

  setDevices: (devices: Device[]) => void;
  setEditingDeviceSerial: (serial: string | null) => void;
  setIsEditingNickname: (editing: boolean) => void;
  setSelectedSerial: (serial: string | null) => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set): DeviceState => ({
      deviceInfo: null,
      devices: [],
      editingDeviceSerial: null,
      isEditingNickname: false,
      lastUpdated: 0,
      reset: () => {
        set({
          deviceInfo: null,
          devices: [],
          lastUpdated: 0,
          selectedSerial: null,
        });
      },
      selectedSerial: null,
      setDeviceInfo: (info) => {
        set({ deviceInfo: info });
      },
      setDevices: (devices) => {
        useMemoryHistoryStore.getState().pruneDisconnected(devices.map((d) => d.serial));
        set((state) => {
          // Skip update when serials + statuses are unchanged (poll thrash)
          const unchanged =
            state.devices.length === devices.length &&
            state.devices.every(
              (d, i) => d.serial === devices[i]?.serial && d.status === devices[i]?.status
            );
          if (unchanged) {
            // Still auto-select if nothing selected but devices exist
            if (!state.selectedSerial && devices.length > 0) {
              return { selectedSerial: devices[0]?.serial ?? null };
            }
            return {};
          }

          let { selectedSerial } = state;
          const previousSerial = selectedSerial;

          // If selected device disconnected → clear selection
          if (selectedSerial && !devices.some((d) => d.serial === selectedSerial)) {
            selectedSerial = null;
          }

          // If nothing selected and devices available → auto-select first
          if (!selectedSerial && devices.length > 0) {
            selectedSerial = devices[0]?.serial ?? null;
          }

          return {
            deviceInfo: selectedSerial === previousSerial ? state.deviceInfo : null,
            devices,
            lastUpdated: Date.now(),
            selectedSerial,
          };
        });
      },
      setEditingDeviceSerial: (editingDeviceSerial) => {
        set({ editingDeviceSerial });
      },
      setIsEditingNickname: (isEditingNickname) => {
        set({ isEditingNickname });
      },
      setSelectedSerial: (serial) => {
        set((state) => ({
          deviceInfo: serial === state.selectedSerial ? state.deviceInfo : null,
          selectedSerial: serial,
        }));
      },
    }),
    {
      name: "device-storage",
      partialize: (state) => ({
        editingDeviceSerial: state.editingDeviceSerial,
        isEditingNickname: state.isEditingNickname,
      }),
      storage: createJSONStorage(() => localStorage),
    }
  )
);
