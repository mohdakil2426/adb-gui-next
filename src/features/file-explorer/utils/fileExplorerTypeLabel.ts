import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';

export function fileTypeLabel(type: FileEntry['type']): string {
  if (type === 'Directory') {
    return 'Folder';
  }
  if (type === 'Symlink') {
    return 'Link';
  }
  return 'File';
}
