import { create } from 'zustand';
import type { backend } from './desktop/models';

type Device = backend.Device;
type DeviceInfo = backend.DeviceInfo;

interface DeviceState {
  devices: Device[];
  selectedSerial: string | null;
  deviceInfo: DeviceInfo | null;
  lastUpdated: number;

  setDevices: (devices: Device[]) => void;
  setSelectedSerial: (serial: string | null) => void;
  setDeviceInfo: (info: DeviceInfo | null) => void;
  reset: () => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  selectedSerial: null,
  deviceInfo: null,
  lastUpdated: 0,

  setDevices: (devices) =>
    set((state) => {
      let { selectedSerial } = state;

      // If selected device disconnected → clear selection
      if (selectedSerial && !devices.some((d) => d.serial === selectedSerial)) {
        selectedSerial = null;
      }

      // If nothing selected and devices available → auto-select first
      if (!selectedSerial && devices.length > 0) {
        selectedSerial = devices[0].serial;
      }

      return { devices, selectedSerial, lastUpdated: Date.now() };
    }),

  setSelectedSerial: (serial) => set({ selectedSerial: serial }),
  setDeviceInfo: (info) => set({ deviceInfo: info }),

  reset: () => set({ devices: [], selectedSerial: null, deviceInfo: null, lastUpdated: 0 }),
}));
