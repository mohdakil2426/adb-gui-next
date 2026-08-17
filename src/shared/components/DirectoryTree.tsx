import { ChevronDown, ChevronRight, Folder, FolderOpen, Loader2 } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListFiles } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import {
  FE_DROP_OVER_CLASS,
  folderInternalDropProps,
} from '@/features/file-explorer/utils/fileExplorerDrop';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { cn } from '@/shared/utils/cn';

/** A directory in the tree. Files are never loaded here — this pane navigates
 *  directories only, and a folder like /sdcard/DCIM can hold thousands of files. */
interface TreeNode {
  children: TreeNode[] | null; // null = not yet loaded
  isExpanded: boolean;
  isLoading: boolean;
  name: string;
  path: string;
}

const INITIAL_NODES: TreeNode[] = [
  {
    path: '/sdcard/',
    name: 'Internal storage',
    isExpanded: false,
    children: null,
    isLoading: false,
  },
  {
    path: '/',
    name: 'Root',
    isExpanded: false,
    children: null,
    isLoading: false,
  },
  {
    path: '/storage/',
    name: 'Storage',
    isExpanded: false,
    children: null,
    isLoading: false,
  },
];

function makeNode(path: string, name: string): TreeNode {
  return {
    path,
    name,
    isExpanded: false,
    children: null,
    isLoading: false,
  };
}

/** Returns the original array when nothing below `targetPath` changed, so
 *  untouched subtrees keep their identity and their memoized rows. */
function applyToNode(
  nodes: TreeNode[],
  targetPath: string,
  updater: (n: TreeNode) => TreeNode,
): TreeNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.path === targetPath) {
      changed = true;
      return updater(node);
    }
    if (node.children) {
      const children = applyToNode(node.children, targetPath, updater);
      if (children !== node.children) {
        changed = true;
        return { ...node, children };
      }
    }
    return node;
  });
  return changed ? next : nodes;
}

function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/** Ancestor directory paths for a given path (excluding self).
 *  /storage/emulated/0/ → ['/storage/', '/storage/emulated/'] */
function getAncestorPaths(path: string): string[] {
  const segments = path.split('/').filter(Boolean);
  return segments.slice(0, -1).map((_, i) => '/' + segments.slice(0, i + 1).join('/') + '/');
}

/** Load the sub-directories of a path (files are intentionally dropped). */
function loadDirEntries(
  path: string,
  serial?: string | null,
  getFileAccessMode: (path: string) => backend.FileAccessMode = () => 'normal',
): Promise<TreeNode[]> {
  return ListFiles(path, serial, getFileAccessMode(path)).then((entries) =>
    entries
      .filter((entry) => entry.type === 'Directory' || entry.type === 'Symlink')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => makeNode(`${path}${entry.name}/`, entry.name)),
  );
}

type FlatRow =
  | { depth: number; isActive: boolean; isAncestor: boolean; kind: 'node'; node: TreeNode }
  | { depth: number; key: string; kind: 'empty' };

/** Flatten the visible tree once per render and resolve active/ancestor state
 *  here, so `currentPath` is not threaded through every node. */
function flattenTree(nodes: TreeNode[], currentPath: string, depth: number, out: FlatRow[]): void {
  for (const node of nodes) {
    const isActive = currentPath === node.path || currentPath === `${node.path}/`;
    const isAncestor = !isActive && node.path !== '/' && currentPath.startsWith(node.path);
    out.push({
      kind: 'node',
      node,
      depth,
      isActive,
      isAncestor,
    });
    if (node.isExpanded && node.children !== null) {
      if (node.children.length === 0) {
        out.push({ kind: 'empty', depth: depth + 1, key: `${node.path}:empty` });
      } else {
        flattenTree(node.children, currentPath, depth + 1, out);
      }
    }
  }
}

interface TreeRowProps {
  depth: number;
  isActive: boolean;
  isAncestor: boolean;
  node: TreeNode;
  onMoveToFolder?: ((destDir: string, names: string[]) => void) | undefined;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
}

const TreeRow = memo(function TreeRow({
  node,
  depth,
  isActive,
  isAncestor,
  onMoveToFolder,
  onSelect,
  onToggle,
}: TreeRowProps) {
  const dropProps = onMoveToFolder ? folderInternalDropProps(node.path, onMoveToFolder) : null;
  return (
    <div
      aria-expanded={node.isExpanded}
      aria-level={depth + 1}
      aria-selected={isActive}
      className={cn(
        'mx-1 flex min-w-0 cursor-pointer select-none items-center gap-2 rounded-md py-1.5 text-body transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        FE_DROP_OVER_CLASS,
        isActive && 'bg-accent font-medium text-accent-foreground',
        isAncestor && 'text-foreground',
        !(isActive || isAncestor) && 'text-muted-foreground',
      )}
      data-fe-drop-dir={node.path}
      onClick={() => {
        onSelect(node.path);
      }}
      onDragEnter={dropProps?.onDragEnter}
      onDragLeave={dropProps?.onDragLeave}
      onDragOver={dropProps?.onDragOver}
      onDrop={dropProps?.onDrop}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(node.path);
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onToggle(node.path);
        }
        if (e.key === 'ArrowLeft' && node.isExpanded) {
          e.preventDefault();
          onToggle(node.path);
        }
      }}
      role="treeitem"
      style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: '8px' }}
      tabIndex={0}
    >
      <button
        aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
        className="flex size-4 shrink-0 items-center justify-center"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onToggle(node.path);
        }}
        tabIndex={-1}
        type="button"
      >
        {node.isLoading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : node.isExpanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4 opacity-50" />
        )}
      </button>

      {node.isExpanded ? (
        <FolderOpen className="size-4 shrink-0 text-primary" />
      ) : (
        <Folder
          className={cn(
            'size-4 shrink-0',
            isActive || isAncestor ? 'text-primary' : 'text-muted-foreground',
          )}
        />
      )}

      <span className="min-w-0 truncate">{node.name}</span>
    </div>
  );
});

export interface DirectoryTreeProps {
  currentPath: string;
  getFileAccessMode?: (path: string) => backend.FileAccessMode;
  onMoveToFolder?: (destDir: string, names: string[]) => void;
  onNavigate: (path: string) => void;
  /** Increment to force-refresh the tree node for currentPath. */
  refreshTrigger?: number;
  serial?: string | null;
}

const defaultFileAccessMode = (): backend.FileAccessMode => 'normal';

export function DirectoryTree({
  currentPath,
  getFileAccessMode = defaultFileAccessMode,
  onNavigate,
  onMoveToFolder,
  refreshTrigger,
  serial,
}: DirectoryTreeProps) {
  const [nodes, setNodesRaw] = useState<TreeNode[]>(() => INITIAL_NODES);

  // Sync ref — always holds latest nodes for use in async callbacks
  const nodesRef = useRef<TreeNode[]>(INITIAL_NODES);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Keep latest access-mode resolver without rebuilding callbacks every render
  // (default prop / unstable parent callback would otherwise thrash deps).
  const getFileAccessModeRef = useRef(getFileAccessMode);
  useEffect(() => {
    getFileAccessModeRef.current = getFileAccessMode;
  }, [getFileAccessMode]);

  // Ref to hold the latest expandToPath (avoids circular useCallback dep)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const expandToPathRef = useRef<(targetPath: string) => void>(() => {});

  const expandToPath = useCallback(
    (targetPath: string) => {
      const ancestors = getAncestorPaths(targetPath);
      const current = nodesRef.current;
      let firstToLoad: string | null = null;
      let result = current;

      for (const ancestor of ancestors) {
        const node = findNode(result, ancestor);
        if (!node || node.isLoading) {
          break;
        }
        if (!node.isExpanded) {
          if (node.children === null) {
            firstToLoad = ancestor;
            result = applyToNode(result, ancestor, (n) => ({
              ...n,
              isLoading: true,
            }));
            break;
          }
          result = applyToNode(result, ancestor, (n) => ({
            ...n,
            isExpanded: true,
          }));
        }
      }

      if (result !== current) {
        nodesRef.current = result;
        setNodesRaw(result);
      }

      if (firstToLoad) {
        const loadPath = firstToLoad;
        loadDirEntries(loadPath, serial, (path) => getFileAccessModeRef.current(path))
          .then((entries) => {
            const next = applyToNode(nodesRef.current, loadPath, (n) => ({
              ...n,
              isLoading: false,
              isExpanded: true,
              children: entries,
            }));
            nodesRef.current = next;
            setNodesRaw(next);
            expandToPathRef.current(targetPath);
          })
          .catch(() => {
            const next = applyToNode(nodesRef.current, loadPath, (n) => ({
              ...n,
              isLoading: false,
            }));
            nodesRef.current = next;
            setNodesRaw(next);
          });
      }
    },
    [serial],
  );

  useEffect(() => {
    expandToPathRef.current = expandToPath;
  }, [expandToPath]);

  // Auto-reveal currentPath in tree when it changes
  useEffect(() => {
    expandToPath(currentPath);
  }, [currentPath, expandToPath]);

  useEffect(() => {
    const next = INITIAL_NODES;
    nodesRef.current = next;
    setNodesRaw(next);
  }, [serial]);

  // Refresh stale children of currentPath when right pane reloads
  const prevRefreshTriggerRef = useRef(0);
  useEffect(() => {
    if (!refreshTrigger || refreshTrigger === prevRefreshTriggerRef.current) {
      return;
    }
    prevRefreshTriggerRef.current = refreshTrigger;

    const node = findNode(nodesRef.current, currentPath);
    if (!node) {
      return;
    }

    if (node.isExpanded) {
      setNodesRaw((prev) => applyToNode(prev, currentPath, (n) => ({ ...n, isLoading: true })));
      loadDirEntries(currentPath, serial, (path) => getFileAccessModeRef.current(path))
        .then((entries) => {
          setNodesRaw((prev) =>
            applyToNode(prev, currentPath, (n) => ({
              ...n,
              isLoading: false,
              children: entries,
            })),
          );
        })
        .catch(() => {
          setNodesRaw((prev) =>
            applyToNode(prev, currentPath, (n) => ({ ...n, isLoading: false })),
          );
        });
    } else {
      // Invalidate cache so it refetches on next expand
      setNodesRaw((prev) => applyToNode(prev, currentPath, (n) => ({ ...n, children: null })));
    }
  }, [refreshTrigger, currentPath, serial]);

  // Toggle expand/collapse with lazy loading
  const handleToggle = useCallback(
    (path: string) => {
      const node = findNode(nodesRef.current, path);
      if (!node || node.isLoading) {
        return;
      }

      if (node.isExpanded) {
        setNodesRaw((prev) => applyToNode(prev, path, (n) => ({ ...n, isExpanded: false })));
        return;
      }
      if (node.children !== null) {
        setNodesRaw((prev) => applyToNode(prev, path, (n) => ({ ...n, isExpanded: true })));
        return;
      }

      setNodesRaw((prev) => applyToNode(prev, path, (n) => ({ ...n, isLoading: true })));

      loadDirEntries(path, serial, (p) => getFileAccessModeRef.current(p))
        .then((entries) => {
          setNodesRaw((prev) =>
            applyToNode(prev, path, (n) => ({
              ...n,
              isLoading: false,
              isExpanded: true,
              children: entries,
            })),
          );
        })
        .catch(() => {
          setNodesRaw((prev) => applyToNode(prev, path, (n) => ({ ...n, isLoading: false })));
        });
    },
    [serial],
  );

  const rows = useMemo(() => {
    const out: FlatRow[] = [];
    flattenTree(nodes, currentPath, 0, out);
    return out;
  }, [nodes, currentPath]);

  return (
    <ScrollArea className="h-full min-h-0 w-full">
      <div aria-label="Device filesystem" className="min-w-0 py-1 pr-1" role="tree">
        {rows.map((row) =>
          row.kind === 'empty' ? (
            <div
              className="py-1.5 text-caption text-muted-foreground italic"
              key={row.key}
              style={{ paddingLeft: `${row.depth * 16 + 32}px` }}
            >
              Empty
            </div>
          ) : (
            <TreeRow
              depth={row.depth}
              isActive={row.isActive}
              isAncestor={row.isAncestor}
              key={row.node.path}
              node={row.node}
              onMoveToFolder={onMoveToFolder}
              onSelect={onNavigate}
              onToggle={handleToggle}
            />
          ),
        )}
      </div>
    </ScrollArea>
  );
}
