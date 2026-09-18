import type {
  FileEntry,
  SortDir,
  SortField,
} from "@/features/file-explorer/model/file-explorer-types";
import { fileTypeLabel } from "@/features/file-explorer/utils/file-explorer-type-label";

/** Sort a file list by field + direction, always keeping dirs before files. */
export const sortEntries = (entries: FileEntry[], field: SortField, dir: SortDir): FileEntry[] =>
  entries.toSorted((a, b) => {
    const aIsDir = a.type === "Directory" || a.type === "Symlink";
    const bIsDir = b.type === "Directory" || b.type === "Symlink";
    if (aIsDir && !bIsDir) {
      return -1;
    }
    if (!aIsDir && bIsDir) {
      return 1;
    }

    if (field === "name") {
      const cmp = a.name.localeCompare(b.name);
      return dir === "asc" ? cmp : -cmp;
    }
    if (field === "size") {
      const aNum = Number.parseInt(a.size, 10);
      const bNum = Number.parseInt(b.size, 10);
      const cmp =
        Number.isNaN(aNum) || Number.isNaN(bNum) ? a.size.localeCompare(b.size) : aNum - bNum;
      return dir === "asc" ? cmp : -cmp;
    }
    if (field === "type") {
      const cmp = fileTypeLabel(a).localeCompare(fileTypeLabel(b));
      return dir === "asc" ? cmp : -cmp;
    }
    const cmp = (a.date + a.time).localeCompare(b.date + b.time);
    return dir === "asc" ? cmp : -cmp;
  });
