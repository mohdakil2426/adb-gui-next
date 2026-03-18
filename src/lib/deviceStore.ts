import { create } from 'zustand';
import type { backend } from './desktop/models';

type Device = backend.Device;
type DeviceInfo = backend.DeviceInfo;

interface DeviceState {
  devices: Device[];
  deviceInfo: DeviceInfo | null;
  lastUpdated: number;

  setDevices: (devices: Device[]) => void;
  setDeviceInfo: (info: DeviceInfo | null) => void;
  reset: () => void;
}

export const useDeviceStore = create<DeviceState>((set) => ({
  devices: [],
  deviceInfo: null,
  lastUpdated: 0,

  setDevices: (devices) => set({ devices, lastUpdated: Date.now() }),
  setDeviceInfo: (info) => set({ deviceInfo: info }),

  reset: () => set({ devices: [], deviceInfo: null, lastUpdated: 0 }),
}));
