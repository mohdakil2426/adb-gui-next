export function isValidDevicePath(path: string | null): path is string {
  if (!path || typeof path !== 'string') {
    return false;
  }
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) {
    return false;
  }
  if (trimmed.includes('..')) {
    return false;
  }
  return true;
}

/** One clickable breadcrumb crumb: what it reads as, and where it goes. */
export interface PathSegment {
  label: string;
  /** Always trailing-slashed — `loadFiles` expects a directory path. */
  path: string;
}

/** Root reads as a drive glyph rather than a bare slash. */
export const ROOT_SEGMENT_LABEL = 'Root directory';

/**
 * Split an absolute device path into navigable crumbs.
 *
 * `/sdcard/Download/` → `Root · sdcard · Download`, where every crumb carries
 * the full path it navigates to. Without this the path bar could only ever be
 * read, never used — clicking `sdcard` to jump up two levels is the single most
 * common navigation in a file manager.
 */
export function toPathSegments(currentPath: string): PathSegment[] {
  const segments: PathSegment[] = [{ label: ROOT_SEGMENT_LABEL, path: '/' }];
  let walked = '';
  for (const part of currentPath.split('/')) {
    if (!part) {
      continue;
    }
    walked += `/${part}`;
    segments.push({ label: part, path: `${walked}/` });
  }
  return segments;
}
