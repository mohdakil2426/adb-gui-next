import { useLogStore } from "@/lib/logStore";

const NICKNAME_STORAGE_KEY = "adb-kit-nicknames";

function getNicknames(): Record<string, string> {
  try {
    const nicknames = localStorage.getItem(NICKNAME_STORAGE_KEY);
    return nicknames ? (JSON.parse(nicknames) as Record<string, string>) : {};
  } catch {
    useLogStore
      .getState()
      .addLog("Failed to parse nicknames from localStorage", "error");
    return {};
  }
}

export function setNickname(serial: string, nickname: string): void {
  const nicknames = getNicknames();
  if (nickname) {
    nicknames[serial] = nickname;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete nicknames[serial];
  }
  localStorage.setItem(NICKNAME_STORAGE_KEY, JSON.stringify(nicknames));
}

export function getNickname(serial: string): string | null {
  const nicknames = getNicknames();
  return nicknames[serial] ?? null;
}
