import { normalizeDirPath } from "@/features/file-explorer/model/file-explorer-places";
import { destinationPath } from "@/features/file-explorer/utils/file-explorer-paths";

export type ClipboardMode = "copy" | "cut";

export interface FileExplorerClipboard {
  mode: ClipboardMode;
  serial: string;
  sources: string[];
}

export type PasteBlockReason = "empty" | "wrong-device" | "same-folder-cut" | "same-folder-copy";

export type PasteCheck = "ok" | PasteBlockReason;

export const PASTE_TOAST: Record<PasteBlockReason, string> = {
  empty: "Nothing to paste",
  "same-folder-copy": "Items are already in this folder",
  "same-folder-cut": "Cannot move items into the same folder",
  "wrong-device": "Clipboard is from another device",
};

const parentDir = (remotePath: string): string => {
  const trimmed = remotePath.replace(/\/+$/u, "");
  const slash = trimmed.lastIndexOf("/");
  if (slash <= 0) {
    return "/";
  }
  return normalizeDirPath(trimmed.slice(0, slash + 1));
};

export const canPasteHere = (
  clip: FileExplorerClipboard | null,
  destDir: string,
  destSerial: string | null
): PasteCheck => {
  if (!clip || clip.sources.length === 0) {
    return "empty";
  }
  if (!destSerial || destSerial !== clip.serial) {
    return "wrong-device";
  }
  const dest = normalizeDirPath(destDir);
  const allSameFolder = clip.sources.every((source) => parentDir(source) === dest);
  if (!allSameFolder) {
    return "ok";
  }
  return clip.mode === "cut" ? "same-folder-cut" : "same-folder-copy";
};

export const plannedDestinations = (clip: FileExplorerClipboard, destDir: string): string[] =>
  clip.sources.map((source) => destinationPath(destDir, source));

export const sourcesFromNames = (currentPath: string, names: Iterable<string>): string[] =>
  [...names].map((name) => destinationPath(currentPath, name));
