import type { backend } from '@/desktop/models';

export type FileEntry = backend.FileEntry;
export type LoadError = 'permission_denied' | 'no_device' | 'unknown' | null;
export type CreatingType = 'file' | 'folder' | null;
export type SortField = 'name' | 'size' | 'date';
export type SortDir = 'asc' | 'desc';
