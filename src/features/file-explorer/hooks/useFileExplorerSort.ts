import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  FileEntry,
  SortDir,
  SortField,
} from '@/features/file-explorer/model/fileExplorerTypes';
import { sortEntries } from '@/features/file-explorer/utils/fileExplorerSorting';

interface UseFileExplorerSortOptions {
  fileList: FileEntry[];
  searchQuery: string;
}

interface UseFileExplorerSortResult {
  handleSortColumn: (field: SortField) => void;
  sortDir: SortDir;
  sortField: SortField;
  visibleList: FileEntry[];
}

export function useFileExplorerSort(
  options: UseFileExplorerSortOptions,
): UseFileExplorerSortResult {
  const { fileList, searchQuery } = options;
  const [sortField, setSortField] = useState<SortField>(() => {
    const saved = localStorage.getItem('fe.sortField');
    return (saved as SortField) || 'name';
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    const saved = localStorage.getItem('fe.sortDir');
    return (saved as SortDir) || 'asc';
  });

  useEffect(() => {
    localStorage.setItem('fe.sortField', sortField);
  }, [sortField]);

  useEffect(() => {
    localStorage.setItem('fe.sortDir', sortDir);
  }, [sortDir]);

  const visibleList = useMemo(
    () =>
      sortEntries(
        searchQuery
          ? fileList.filter((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
          : fileList,
        sortField,
        sortDir,
      ),
    [fileList, searchQuery, sortField, sortDir],
  );

  const handleSortColumn = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortDir('asc');
      }
      return field;
    });
  }, []);

  return { handleSortColumn, sortDir, sortField, visibleList };
}
