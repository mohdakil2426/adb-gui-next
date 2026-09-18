import { create } from "zustand";

import { useLogStore } from "@/shared/stores/log-store";

export const NICKNAME_STORAGE_KEY = "adb-kit-nicknames:v1";

type NicknameMap = Record<string, string>;

/** Single localStorage read + parse. Everything after this is served from memory. */
const readNicknamesFromStorage = (): NicknameMap => {
  try {
    const raw = localStorage.getItem(NICKNAME_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NicknameMap) : {};
  } catch {
    useLogStore.getState().addLog("Failed to parse nicknames from localStorage", "error");
    return {};
  }
};

interface NicknameStore {
  nicknames: NicknameMap;
  setNickname: (serial: string, nickname: string) => void;
}

export const useNicknameStore = create<NicknameStore>((set, get) => ({
  nicknames: readNicknamesFromStorage(),

  setNickname: (serial, nickname) => {
    const next: NicknameMap = {};
    for (const [key, value] of Object.entries(get().nicknames)) {
      if (key !== serial) {
        next[key] = value;
      }
    }
    if (nickname) {
      next[serial] = nickname;
    }
    localStorage.setItem(NICKNAME_STORAGE_KEY, JSON.stringify(next));
    set({ nicknames: next });
  },
}));

/** Reactive lookup for render bodies — re-renders only when this serial's nickname changes. */
export const useNickname = (serial: string | null | undefined): string | null =>
  useNicknameStore((state) => (serial ? (state.nicknames[serial] ?? null) : null));

/** Imperative lookup for handlers and effects. Never call this in a render body. */
export const getNickname = (serial: string): string | null =>
  useNicknameStore.getState().nicknames[serial] ?? null;

export const setNickname = (serial: string, nickname: string): void => {
  useNicknameStore.getState().setNickname(serial, nickname);
};
