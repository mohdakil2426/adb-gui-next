import * as eventApi from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { openUrl } from '@tauri-apps/plugin-opener';

type EventCallback = (...data: any[]) => void;
type Unlisten = () => void;
type FileDropCallback = (x: number, y: number, paths: string[]) => void;

type ListenerEntry = {
  dispose: Unlisten;
};

const eventListeners = new Map<string, Set<ListenerEntry>>();
let fileDropCleanup: Unlisten | null = null;
let fileDropRegistrationId = 0;

function removeListener(eventName: string, entry: ListenerEntry): void {
  const current = eventListeners.get(eventName);
  if (!current) {
    return;
  }

  current.delete(entry);
  if (current.size === 0) {
    eventListeners.delete(eventName);
  }
}

function registerEventListener(eventName: string, callback: EventCallback): () => void {
  const current = eventListeners.get(eventName) ?? new Set<ListenerEntry>();
  eventListeners.set(eventName, current);

  let active = true;
  let unlisten: Unlisten | null = null;

  const entry: ListenerEntry = {
    dispose: () => {
      if (!active) {
        return;
      }

      active = false;
      removeListener(eventName, entry);

      if (unlisten) {
        unlisten();
      }
    },
  };

  current.add(entry);

  void eventApi
    .listen(eventName, (event: any) => {
      if (active) {
        callback(event.payload);
      }
    })
    .then((dispose) => {
      if (!active) {
        dispose();
        return;
      }

      unlisten = () => {
        if (!active) {
          return;
        }

        active = false;
        dispose();
        removeListener(eventName, entry);
      };
    });

  return entry.dispose;
}

export function BrowserOpenURL(url: string | URL): void {
  void openUrl(url);
}

export function EventsOn(eventName: string, callback: EventCallback): () => void {
  return registerEventListener(eventName, callback);
}

export function EventsOff(eventName: string, ...additionalEventNames: string[]): void {
  [eventName, ...additionalEventNames].forEach((name) => {
    const current = eventListeners.get(name);
    if (!current) {
      return;
    }

    [...current].forEach((entry) => entry.dispose());
  });
}

export function EventsOffAll(): void {
  [...eventListeners.keys()].forEach((eventName) => {
    EventsOff(eventName);
  });
}

export function OnFileDrop(callback: FileDropCallback, _useDropTarget: boolean): void {
  if (fileDropCleanup) {
    fileDropCleanup();
    fileDropCleanup = null;
  }

  const registrationId = ++fileDropRegistrationId;

  void getCurrentWebview()
    .onDragDropEvent((event: any) => {
      const payload = event.payload;
      if (payload?.type !== 'drop' || !Array.isArray(payload.paths)) {
        return;
      }

      const position = payload.position ?? { x: 0, y: 0 };
      callback(position.x ?? 0, position.y ?? 0, payload.paths);
    })
    .then((cleanup: Unlisten) => {
      if (registrationId !== fileDropRegistrationId) {
        cleanup();
        return;
      }

      fileDropCleanup = cleanup;
    });
}

export function OnFileDropOff(): void {
  fileDropRegistrationId += 1;
  if (fileDropCleanup) {
    fileDropCleanup();
    fileDropCleanup = null;
  }
}
