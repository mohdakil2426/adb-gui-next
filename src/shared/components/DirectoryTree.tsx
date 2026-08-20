import { ChevronDown, ChevronRight, Folder, FolderOpen, Loader2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListFiles } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import {
  FE_DROP_OVER_CLASS,
  folderInternalDropProps,
} from '@/features/file-explorer/utils/fileExplorerDrop';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { cn } from '@/shared/utils/cn';

// Empty state handled across UI when data?.length === 0
// Status updates announced via role="status" / aria-live="polite"

/** A directory in the tree with a globally unique node ID. */
interface TreeNode {
  children: TreeNode[] | null;
  id: string;
  isExpanded: boolean;
  isLoading: boolean;
  name: string;
  path: string;
}

const INITIAL_NODES: TreeNode[] = [
  {
    id: 'top:sdcard',
    path: '/sdcard/',
    name: 'Internal storage',
    isExpanded: false,
    children: null,
    isLoading: false,
  },
  {
    id: 'top:root',
    path: '/',
    name: 'Root',
    isExpanded: false,
    children: null,
    isLoading: false,
  },
  {
    id: 'top:storage',
    path: '/storage/',
    name: 'Storage',
    isExpanded: false,
    children: null,
    isLoading: false,
  },
];

function makeNode(id: string, path: string, name: string): TreeNode {
  return {
    id,
    path,
    name,
    isExpanded: false,
    children: null,
    isLoading: false,
  };
}

/** Immutable node updater matching strictly by unique node ID. */
function applyToNodeById(
  nodes: TreeNode[],
  targetId: string,
  updater: (n: TreeNode) => TreeNode,
): TreeNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    if (node.id === targetId) {
      changed = true;
      return updater(node);
    }
    if (node.children) {
      const children = applyToNodeById(node.children, targetId, updater);
      if (children !== node.children) {
        changed = true;
        return { ...node, children };
      }
    }
    return node;
  });
  return changed ? next : nodes;
}

function findNodeById(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function joinTreePath(parentPath: string, entryName: string): string {
  const cleanName = entryName.replace(/^\/+|\/+$/g, '');
  if (parentPath === '/' || parentPath === '') {
    return `/${cleanName}/`;
  }
  const cleanParent = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;
  return `${cleanParent}${cleanName}/`;
}

/** Load the sub-directories of a path with unique child IDs. */
function loadDirEntries(
  parentId: string,
  path: string,
  serial?: string | null,
  getFileAccessMode: (path: string) => backend.FileAccessMode = () => 'normal',
): Promise<TreeNode[]> {
  return ListFiles(path, serial, getFileAccessMode(path)).then((entries) =>
    entries
      .filter(
        (entry) =>
          (entry.type === 'Directory' || entry.type === 'Symlink') &&
          entry.name &&
          !entry.name.startsWith('->') &&
          entry.name !== '?' &&
          entry.name !== '.' &&
          entry.name !== '..',
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) =>
        makeNode(`${parentId}/${entry.name}`, joinTreePath(path, entry.name), entry.name),
      ),
  );
}

type FlatRow =
  | { depth: number; isActive: boolean; isAncestor: boolean; kind: 'node'; node: TreeNode }
  | { depth: number; key: string; kind: 'empty' };

/** Flatten visible nodes into flat render list. Subtrees are rendered ONLY if parent isExpanded. */
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
    // Subtree is flattened ONLY when parent node isExpanded is strictly true
    if (node.isExpanded && node.children !== null) {
      if (node.children.length === 0) {
        out.push({ kind: 'empty', depth: depth + 1, key: `${node.id}:empty` });
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
  onToggle: (id: string, path: string) => void;
}

const TreeRow = memo(function TreeRow({
  depth,
  isActive,
  isAncestor,
  node,
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
          onToggle(node.id, node.path);
        }
        if (e.key === 'ArrowLeft' && node.isExpanded) {
          e.preventDefault();
          onToggle(node.id, node.path);
        }
      }}
      onPointerDown={() => {
        onSelect(node.path);
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
          onToggle(node.id, node.path);
        }}
        tabIndex={-1}
        type="button"
      >
        {node.isLoading ? (
          <Loader2
            aria-label="Loading directory…"
            className="size-3.5 animate-spin"
            role="status"
          />
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
  const [prevSerial, setPrevSerial] = useState(serial);
  if (serial !== prevSerial) {
    setPrevSerial(serial);
    setNodesRaw(INITIAL_NODES);
  }

  // Sync ref — always holds latest nodes for use in async callbacks
  const nodesRef = useRef<TreeNode[]>(INITIAL_NODES);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const updateNodes = useCallback((updater: (prev: TreeNode[]) => TreeNode[]) => {
    setNodesRaw(updater);
  }, []);

  const getFileAccessModeRef = useRef(getFileAccessMode);
  useEffect(() => {
    getFileAccessModeRef.current = getFileAccessMode;
  }, [getFileAccessMode]);

  // Refresh stale children of currentPath when right pane reloads
  const prevRefreshTriggerRef = useRef(0);
  useEffect(() => {
    if (!refreshTrigger || refreshTrigger === prevRefreshTriggerRef.current) {
      return;
    }
    prevRefreshTriggerRef.current = refreshTrigger;

    const findTargetInNodes = (list: TreeNode[]): TreeNode | null => {
      for (const n of list) {
        if (n.path === currentPath || n.path === `${currentPath}/`) {
          return n;
        }
        if (n.children) {
          const found = findTargetInNodes(n.children);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };

    const targetNode = findTargetInNodes(nodesRef.current);
    if (!targetNode) {
      return;
    }

    const targetId = targetNode.id;
    if (targetNode.isExpanded) {
      updateNodes((prev) => applyToNodeById(prev, targetId, (n) => ({ ...n, isLoading: true })));
      loadDirEntries(targetId, currentPath, serial, (path) => getFileAccessModeRef.current(path))
        .then((entries) => {
          updateNodes((prev) =>
            applyToNodeById(prev, targetId, (n) => ({
              ...n,
              isLoading: false,
              children: entries,
            })),
          );
        })
        .catch(() => {
          updateNodes((prev) =>
            applyToNodeById(prev, targetId, (n) => ({ ...n, isLoading: false })),
          );
        });
    } else {
      updateNodes((prev) => applyToNodeById(prev, targetId, (n) => ({ ...n, children: null })));
    }
  }, [refreshTrigger, currentPath, serial, updateNodes]);

  // Toggle expand/collapse with lazy loading by unique node ID
  const handleToggle = useCallback(
    (id: string, path: string) => {
      const node = findNodeById(nodesRef.current, id);
      if (!node || node.isLoading) {
        return;
      }

      // If currently expanded -> collapse it cleanly
      if (node.isExpanded) {
        updateNodes((prev) => applyToNodeById(prev, id, (n) => ({ ...n, isExpanded: false })));
        return;
      }

      // If already loaded -> expand immediately
      if (node.children !== null) {
        updateNodes((prev) => applyToNodeById(prev, id, (n) => ({ ...n, isExpanded: true })));
        return;
      }

      // Lazy load children
      updateNodes((prev) => applyToNodeById(prev, id, (n) => ({ ...n, isLoading: true })));

      loadDirEntries(id, path, serial, (p) => getFileAccessModeRef.current(p))
        .then((entries) => {
          updateNodes((prev) =>
            applyToNodeById(prev, id, (n) => ({
              ...n,
              isLoading: false,
              isExpanded: true,
              children: entries,
            })),
          );
        })
        .catch(() => {
          updateNodes((prev) => applyToNodeById(prev, id, (n) => ({ ...n, isLoading: false })));
        });
    },
    [serial, updateNodes],
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
              key={row.node.id}
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
