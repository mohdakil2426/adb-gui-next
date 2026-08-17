export interface FileExplorerPlace {
  id: string;
  label: string;
  path: string;
}

/**
 * Phone analogues of Explorer’s pinned folders. Jumps only — the live tree
 * under Root / Storage stays the hierarchy.
 */
export const FILE_EXPLORER_PLACES: FileExplorerPlace[] = [
  { id: 'download', label: 'Download', path: '/sdcard/Download/' },
  { id: 'documents', label: 'Documents', path: '/sdcard/Documents/' },
  { id: 'pictures', label: 'Pictures', path: '/sdcard/Pictures/' },
  { id: 'dcim', label: 'DCIM', path: '/sdcard/DCIM/' },
  { id: 'movies', label: 'Movies', path: '/sdcard/Movies/' },
  { id: 'music', label: 'Music', path: '/sdcard/Music/' },
];

export function normalizeDirPath(path: string): string {
  if (path === '/') {
    return '/';
  }
  return path.endsWith('/') ? path : `${path}/`;
}

/** Longest matching pin, so Download wins over a parent folder. */
export function activePlaceId(currentPath: string): string | null {
  const current = normalizeDirPath(currentPath);
  let best: FileExplorerPlace | null = null;
  for (const place of FILE_EXPLORER_PLACES) {
    if (current === place.path || current.startsWith(place.path)) {
      if (!best || place.path.length > best.path.length) {
        best = place;
      }
    }
  }
  return best?.id ?? null;
}
