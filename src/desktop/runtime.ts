import type { Event } from "@tauri-apps/api/event";
import * as eventApi from "@tauri-apps/api/event";
import type { DragDropEvent } from "@tauri-apps/api/webview";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";

// Generic event callback — T is the event payload type.
type EventCallback<T = unknown> = (data: T) => void;
type Unlisten = () => void;
type FileDropCallback = (x: number, y: number, paths: string[]) => void;

interface ListenerEntry {
  dispose: Unlisten;
}

const eventListeners = new Map<string, Set<ListenerEntry>>();
let fileDropCleanup: Unlisten | null = null;
let fileDropRegistrationId = 0;

const removeListener = (eventName: string, entry: ListenerEntry): void => {
  const current = eventListeners.get(eventName);
  if (!current) {
    return;
  }

  current.delete(entry);
  if (current.size === 0) {
    eventListeners.delete(eventName);
  }
};

const registerEventListener = <T = unknown>(
  eventName: string,
  listener: EventCallback<T>
): (() => void) => {
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

  void (async () => {
    const dispose = await eventApi.listen<T>(eventName, (event: Event<T>) => {
      if (active) {
        listener(event.payload);
      }
    });

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
  })();

  return entry.dispose;
};

const toSafeExternalUrl = (url: string | URL): string | null => {
  try {
    const parsed = url instanceof URL ? url : new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

export const BrowserOpenURL = (url: string | URL): void => {
  const safeUrl = toSafeExternalUrl(url);
  if (!safeUrl) {
    toast.error("Unable to open link", {
      description: "Only valid HTTP/HTTPS URLs are allowed.",
    });
    return;
  }

  void (async () => {
    try {
      await openUrl(safeUrl);
    } catch (error: unknown) {
      toast.error("Unable to open link", {
        description: String(error),
      });
    }
  })();
};

export const EventsOn = <T = unknown>(
  eventName: string,
  listener: EventCallback<T>
): (() => void) => registerEventListener<T>(eventName, listener);

export const EventsOff = (eventName: string, ...additionalEventNames: string[]): void => {
  for (const name of [eventName, ...additionalEventNames]) {
    const current = eventListeners.get(name);
    if (!current) {
      continue;
    }

    for (const entry of current) {
      entry.dispose();
    }
  }
};

export const EventsOffAll = (): void => {
  for (const eventName of eventListeners.keys()) {
    EventsOff(eventName);
  }
};

export interface DragDropHandler {
  onCancel?: () => void;
  onDrop: (paths: string[], x: number, y: number) => void;
  /** Called continuously while files are dragged over the window. `paths` may
   *  be available on some platforms / Tauri versions — always treat as optional. */
  onHover?: (x: number, y: number, paths?: string[]) => void;
}

export const OnFileDrop = (
  handlerInput: FileDropCallback | DragDropHandler,
  _useDropTarget?: boolean
): void => {
  if (fileDropCleanup) {
    fileDropCleanup();
    fileDropCleanup = null;
  }

  fileDropRegistrationId += 1;
  const registrationId = fileDropRegistrationId;

  // Normalize to DragDropHandler
  const handler: DragDropHandler =
    typeof handlerInput === "function"
      ? {
          onDrop: (paths, x, y) => {
            handlerInput(x, y, paths);
          },
        }
      : handlerInput;

  void (async () => {
    const cleanup = await getCurrentWebview().onDragDropEvent((event: Event<DragDropEvent>) => {
      const { payload } = event;
      if (!payload.type) {
        return;
      }

      if (payload.type === "enter" || payload.type === "over") {
        const pos = payload.position ?? { x: 0, y: 0 };
        const paths =
          "paths" in payload && Array.isArray(payload.paths) ? payload.paths : undefined;
        handler.onHover?.(pos.x, pos.y, paths);
      } else if (payload.type === "drop" && "paths" in payload && Array.isArray(payload.paths)) {
        const pos = payload.position ?? { x: 0, y: 0 };
        handler.onDrop(payload.paths, pos.x, pos.y);
      } else if (payload.type === "leave") {
        handler.onCancel?.();
      }
    });

    if (registrationId !== fileDropRegistrationId) {
      cleanup();
      return;
    }

    fileDropCleanup = cleanup;
  })();
};

export const OnFileDropOff = (): void => {
  fileDropRegistrationId += 1;
  if (fileDropCleanup) {
    fileDropCleanup();
    fileDropCleanup = null;
  }
};
