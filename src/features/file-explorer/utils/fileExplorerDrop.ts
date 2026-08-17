export const INTERNAL_FILES_MIME = 'application/x-adb-gui-files';

/** Highlight class for folder drop targets. Driven by a DOM attribute so hover
 *  does not re-render the virtual list. */
export const FE_DROP_OVER_CLASS =
  'data-fe-drop-over:bg-accent data-fe-drop-over:text-accent-foreground data-fe-drop-over:ring-1 data-fe-drop-over:ring-ring';

export function parseInternalFileNames(dataTransfer: DataTransfer | null): string[] | null {
  const raw = dataTransfer?.getData(INTERNAL_FILES_MIME);
  if (!raw) {
    return null;
  }
  try {
    const names: unknown = JSON.parse(raw);
    if (!Array.isArray(names) || names.some((name) => typeof name !== 'string')) {
      return null;
    }
    return names;
  } catch {
    return null;
  }
}

export function setDropOver(element: Element | null, on: boolean): void {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  if (on) {
    element.setAttribute('data-fe-drop-over', '');
    return;
  }
  element.removeAttribute('data-fe-drop-over');
}

export function closestFileExplorerDropTarget(x: number, y: number): HTMLElement | null {
  const hit = document.elementFromPoint(x, y);
  if (!(hit instanceof Element)) {
    return null;
  }
  return hit.closest<HTMLElement>('[data-fe-drop-dir], [data-fe-drop-pane]');
}

export function destDirFromDropTarget(
  element: HTMLElement | null,
  fallback: string,
): string | null {
  if (!element) {
    return null;
  }
  return (
    element.getAttribute('data-fe-drop-dir') ??
    element.getAttribute('data-fe-drop-pane') ??
    fallback
  );
}

function isInternalDrag(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer?.types.includes(INTERNAL_FILES_MIME));
}

export function folderInternalDropProps(
  destDir: string,
  onMove: (destDir: string, names: string[]) => void,
  options?: { rejectNames?: Iterable<string> },
): {
  onDragEnter: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
} {
  const rejected = options?.rejectNames ? new Set(options.rejectNames) : null;
  return {
    onDragEnter: (event) => {
      if (!isInternalDrag(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      setDropOver(event.currentTarget, true);
    },
    onDragLeave: (event) => {
      const related = event.relatedTarget;
      if (related instanceof Node && event.currentTarget.contains(related)) {
        return;
      }
      setDropOver(event.currentTarget, false);
    },
    onDragOver: (event) => {
      if (!isInternalDrag(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    onDrop: (event) => {
      setDropOver(event.currentTarget, false);
      const names = parseInternalFileNames(event.dataTransfer);
      if (!names) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (rejected && names.some((name) => rejected.has(name))) {
        return;
      }
      onMove(destDir, names);
    },
  };
}
