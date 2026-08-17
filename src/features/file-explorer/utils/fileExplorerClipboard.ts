import { normalizeDirPath } from '@/features/file-explorer/model/fileExplorerPlaces';
import { destinationPath } from '@/features/file-explorer/utils/fileExplorerPaths';

export type ClipboardMode = 'copy' | 'cut';

export interface FileExplorerClipboard {
  mode: ClipboardMode;
  serial: string;
  sources: string[];
}

export type PasteBlockReason = 'empty' | 'wrong-device' | 'same-folder-cut' | 'same-folder-copy';

export type PasteCheck = 'ok' | PasteBlockReason;

export const PASTE_TOAST: Record<PasteBlockReason, string> = {
  empty: 'Nothing to paste',
  'wrong-device': 'Clipboard is from another device',
  'same-folder-cut': 'Cannot move items into the same folder',
  'same-folder-copy': 'Items are already in this folder',
};

function parentDir(remotePath: string): string {
  const trimmed = remotePath.replace(/\/+$/, '');
  const slash = trimmed.lastIndexOf('/');
  if (slash <= 0) {
    return '/';
  }
  return normalizeDirPath(trimmed.slice(0, slash + 1));
}

export function canPasteHere(
  clip: FileExplorerClipboard | null,
  destDir: string,
  destSerial: string | null,
): PasteCheck {
  if (!clip || clip.sources.length === 0) {
    return 'empty';
  }
  if (!destSerial || destSerial !== clip.serial) {
    return 'wrong-device';
  }
  const dest = normalizeDirPath(destDir);
  const allSameFolder = clip.sources.every((source) => parentDir(source) === dest);
  if (!allSameFolder) {
    return 'ok';
  }
  return clip.mode === 'cut' ? 'same-folder-cut' : 'same-folder-copy';
}

export function plannedDestinations(clip: FileExplorerClipboard, destDir: string): string[] {
  return clip.sources.map((source) => destinationPath(destDir, source));
}

export function sourcesFromNames(currentPath: string, names: Iterable<string>): string[] {
  return [...names].map((name) => destinationPath(currentPath, name));
}
