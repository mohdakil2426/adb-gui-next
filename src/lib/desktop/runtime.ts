import * as eventApi from '@tauri-apps/api/event';
import type { Event } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import type { DragDropEvent } from '@tauri-apps/api/webview';
import { openUrl } from '@tauri-apps/plugin-opener';

// Generic event callback — T is the event payload type.
type EventCallback<T = unknown> = (data: T) => void;
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

function registerEventListener<T = unknown>(
  eventName: string,
  callback: EventCallback<T>,
): () => void {
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
    .listen<T>(eventName, (event: Event<T>) => {
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

export function EventsOn<T = unknown>(eventName: string, callback: EventCallback<T>): () => void {
  return registerEventListener<T>(eventName, callback);
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

export interface DragDropHandler {
  onDrop: (paths: string[], x: number, y: number) => void;
  /** Called continuously while files are dragged over the window. `paths` may
   *  be available on some platforms / Tauri versions — always treat as optional. */
  onHover?: (x: number, y: number, paths?: string[]) => void;
  onCancel?: () => void;
}

export function OnFileDrop(
  callbackOrHandler: FileDropCallback | DragDropHandler,
  _useDropTarget?: boolean,
): void {
  if (fileDropCleanup) {
    fileDropCleanup();
    fileDropCleanup = null;
  }

  const registrationId = ++fileDropRegistrationId;

  // Normalize to DragDropHandler
  const handler: DragDropHandler =
    typeof callbackOrHandler === 'function'
      ? { onDrop: (paths, x, y) => callbackOrHandler(x, y, paths) }
      : callbackOrHandler;

  void getCurrentWebview()
    .onDragDropEvent((event: Event<DragDropEvent>) => {
      const payload = event.payload;
      if (!payload?.type) return;

      if (payload.type === 'enter' || payload.type === 'over') {
        const pos = payload.position ?? { x: 0, y: 0 };
        const paths =
          'paths' in payload && Array.isArray(payload.paths) ? payload.paths : undefined;
        handler.onHover?.(pos.x ?? 0, pos.y ?? 0, paths);
      } else if (payload.type === 'drop' && 'paths' in payload && Array.isArray(payload.paths)) {
        const pos = payload.position ?? { x: 0, y: 0 };
        handler.onDrop(payload.paths, pos.x ?? 0, pos.y ?? 0);
      } else if (payload.type === 'leave') {
        handler.onCancel?.();
      }
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
