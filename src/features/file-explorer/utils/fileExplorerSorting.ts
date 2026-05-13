import type {
  FileEntry,
  SortDir,
  SortField,
} from '@/features/file-explorer/model/fileExplorerTypes';

/** Sort a file list by field + direction, always keeping dirs before files. */
export function sortEntries(entries: FileEntry[], field: SortField, dir: SortDir): FileEntry[] {
  return [...entries].sort((a, b) => {
    const aIsDir = a.type === 'Directory' || a.type === 'Symlink';
    const bIsDir = b.type === 'Directory' || b.type === 'Symlink';
    if (aIsDir && !bIsDir) {
      return -1;
    }
    if (!aIsDir && bIsDir) {
      return 1;
    }

    if (field === 'name') {
      const cmp = a.name.localeCompare(b.name);
      return dir === 'asc' ? cmp : -cmp;
    }
    if (field === 'size') {
      const aNum = Number.parseInt(a.size, 10);
      const bNum = Number.parseInt(b.size, 10);
      const cmp = isNaN(aNum) || isNaN(bNum) ? a.size.localeCompare(b.size) : aNum - bNum;
      return dir === 'asc' ? cmp : -cmp;
    }
    const cmp = (a.date + a.time).localeCompare(b.date + b.time);
    return dir === 'asc' ? cmp : -cmp;
  });
}
