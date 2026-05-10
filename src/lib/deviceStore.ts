import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { backend } from './desktop/models';

type Device = backend.Device;
type DeviceInfo = backend.DeviceInfo;

interface DeviceState {
  // ── Device Data ────────────────────────────────────────────────────────────
  devices: Device[];
  selectedSerial: string | null;
  deviceInfo: DeviceInfo | null;
  lastUpdated: number;

  // ── UI State (for persistence) ──────────────────────────────────────────────
  isEditingNickname: boolean;
  editingDeviceSerial: string | null;

  setDevices: (devices: Device[]) => void;
  setSelectedSerial: (serial: string | null) => void;
  setDeviceInfo: (info: DeviceInfo | null) => void;
  setIsEditingNickname: (editing: boolean) => void;
  setEditingDeviceSerial: (serial: string | null) => void;
  reset: () => void;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set): DeviceState => ({
      devices: [],
      selectedSerial: null,
      deviceInfo: null,
      lastUpdated: 0,

      isEditingNickname: false,
      editingDeviceSerial: null,

      setDevices: (devices) => {
        set((state) => {
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
            devices,
            selectedSerial,
            deviceInfo: selectedSerial === previousSerial ? state.deviceInfo : null,
            lastUpdated: Date.now(),
          };
        });
      },

      setSelectedSerial: (serial) => {
        set((state) => ({
          selectedSerial: serial,
          deviceInfo: serial === state.selectedSerial ? state.deviceInfo : null,
        }));
      },
      setDeviceInfo: (info) => {
        set({ deviceInfo: info });
      },
      setIsEditingNickname: (isEditingNickname) => {
        set({ isEditingNickname });
      },
      setEditingDeviceSerial: (editingDeviceSerial) => {
        set({ editingDeviceSerial });
      },

      reset: () => {
        set({ devices: [], selectedSerial: null, deviceInfo: null, lastUpdated: 0 });
      },
    }),
    {
      name: 'device-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isEditingNickname: state.isEditingNickname,
        editingDeviceSerial: state.editingDeviceSerial,
      }),
    },
  ),
);
