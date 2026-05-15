import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface WirelessAdbState {
  isCollapsibleOpen: boolean;
  persistedIp: string;
  persistedPort: string;
  setIsCollapsibleOpen: (open: boolean) => void;
  setPersistedIp: (ip: string) => void;
  setPersistedPort: (port: string) => void;
}

export const useWirelessAdbStore = create<WirelessAdbState>()(
  persist(
    (set) => ({
      isCollapsibleOpen: false,
      persistedIp: '',
      persistedPort: '5555',

      setIsCollapsibleOpen: (isCollapsibleOpen) => {
        set({ isCollapsibleOpen });
      },
      setPersistedIp: (persistedIp) => {
        set({ persistedIp });
      },
      setPersistedPort: (persistedPort) => {
        set({ persistedPort });
      },
    }),
    {
      name: 'wireless-adb-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
