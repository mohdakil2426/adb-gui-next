import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Loader2, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ListFiles } from '@/lib/desktop/backend';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TreeNode {
  path: string;
  name: string;
  isDirectory: boolean;
  isExpanded: boolean;
  children: TreeNode[] | null; // null = not yet loaded (dirs only)
  isLoading: boolean;
}

const INITIAL_NODES: TreeNode[] = [
  {
    path: '/sdcard/',
    name: 'sdcard',
    isDirectory: true,
    isExpanded: false,
    children: null,
    isLoading: false,
  },
  {
    path: '/storage/',
    name: 'storage',
    isDirectory: true,
    isExpanded: false,
    children: null,
    isLoading: false,
  },
  {
    path: '/data/',
    name: 'data',
    isDirectory: true,
    isExpanded: false,
    children: null,
    isLoading: false,
  },
];

function makeNode(path: string, name: string, isDirectory: boolean): TreeNode {
  return { path, name, isDirectory, isExpanded: false, children: null, isLoading: false };
}

function applyToNode(
  nodes: TreeNode[],
  targetPath: string,
  updater: (n: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) return updater(node);
    if (node.children) {
      return { ...node, children: applyToNode(node.children, targetPath, updater) };
    }
    return node;
  });
}

function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
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

/** Load all entries (files + dirs) for a path and return as TreeNode[]. */
function loadDirEntries(path: string): Promise<TreeNode[]> {
  return ListFiles(path).then((entries) =>
    entries
      .sort((a, b) => {
        const aIsDir = a.type === 'Directory' || a.type === 'Symlink';
        const bIsDir = b.type === 'Directory' || b.type === 'Symlink';
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((e) => {
        const isDir = e.type === 'Directory' || e.type === 'Symlink';
        return makeNode(isDir ? `${path}${e.name}/` : `${path}${e.name}`, e.name, isDir);
      }),
  );
}

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  currentPath: string;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
}

function TreeRow({ node, depth, currentPath, onSelect, onToggle }: TreeRowProps) {
  const isActive = currentPath === node.path || currentPath === `${node.path}/`;
  const isAncestor = !isActive && node.isDirectory && currentPath.startsWith(node.path);

  return (
    <>
      <div
        role="treeitem"
        aria-expanded={node.isDirectory ? node.isExpanded : undefined}
        aria-selected={isActive}
        tabIndex={0}
        className={cn(
          'flex items-center gap-2 py-[3px] rounded-sm text-sm cursor-pointer select-none transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isActive && 'bg-accent text-accent-foreground font-medium',
          isAncestor && 'text-foreground',
          !isActive && !isAncestor && 'text-muted-foreground',
        )}
        style={{ paddingLeft: `${depth * 14 + 6}px`, paddingRight: '6px' }}
        onClick={() => {
          if (node.isDirectory) {
            onSelect(node.path);
          } else {
            // Navigate right pane to the directory that contains this file
            const parentPath = node.path.substring(0, node.path.lastIndexOf('/') + 1);
            onSelect(parentPath);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (node.isDirectory) {
              onSelect(node.path);
            } else {
              const parentPath = node.path.substring(0, node.path.lastIndexOf('/') + 1);
              onSelect(parentPath);
            }
          }
          if (e.key === 'ArrowRight' && node.isDirectory) {
            e.preventDefault();
            onToggle(node.path);
          }
          if (e.key === 'ArrowLeft' && node.isDirectory && node.isExpanded) {
            e.preventDefault();
            onToggle(node.path);
          }
        }}
      >
        {/* Expand chevron — only for directories */}
        <span
          className="shrink-0 flex items-center justify-center size-4"
          onClick={
            node.isDirectory
              ? (e) => {
                  e.stopPropagation();
                  onToggle(node.path);
                }
              : undefined
          }
        >
          {node.isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : !node.isDirectory ? (
            <span className="size-4" /> // spacer for file alignment
          ) : node.isExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4 opacity-50" />
          )}
        </span>

        {/* Icon */}
        {node.isDirectory ? (
          node.isExpanded ? (
            <FolderOpen className="size-4 shrink-0 text-primary" />
          ) : (
            <Folder
              className={cn(
                'size-4 shrink-0',
                isActive || isAncestor ? 'text-primary' : 'text-muted-foreground',
              )}
            />
          )
        ) : (
          <File className="size-4 shrink-0 text-muted-foreground opacity-70" />
        )}

        <span className="truncate">{node.name}</span>
      </div>

      {/* Children — only dirs expand */}
      {node.isDirectory && node.isExpanded && node.children && (
        <>
          {node.children.length === 0 ? (
            <div
              className="py-1 text-xs text-muted-foreground italic"
              style={{ paddingLeft: `${(depth + 1) * 14 + 28}px` }}
            >
              Empty
            </div>
          ) : (
            node.children.map((child) => (
              <TreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                currentPath={currentPath}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))
          )}
        </>
      )}
    </>
  );
}

export interface DirectoryTreeProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  /** Increment to force-refresh the tree node for currentPath. */
  refreshTrigger?: number;
}

export function DirectoryTree({ currentPath, onNavigate, refreshTrigger }: DirectoryTreeProps) {
  const [nodes, setNodesRaw] = useState<TreeNode[]>(INITIAL_NODES);

  // Sync ref — always holds latest nodes for use in async callbacks
  const nodesRef = useRef<TreeNode[]>(INITIAL_NODES);
  const setNodes = useCallback((updater: (prev: TreeNode[]) => TreeNode[]) => {
    setNodesRaw((prev) => {
      const next = updater(prev);
      nodesRef.current = next;
      return next;
    });
  }, []);

  // Ref to hold the latest expandToPath (avoids circular useCallback dep)
  const expandToPathRef = useRef<(targetPath: string) => void>(() => {});

  const expandToPath = useCallback(
    (targetPath: string) => {
      const ancestors = getAncestorPaths(targetPath);
      const current = nodesRef.current;
      let firstToLoad: string | null = null;
      let result = current;

      for (const ancestor of ancestors) {
        const node = findNode(result, ancestor);
        if (!node || !node.isDirectory || node.isLoading) break;
        if (!node.isExpanded) {
          if (node.children !== null) {
            result = applyToNode(result, ancestor, (n) => ({ ...n, isExpanded: true }));
          } else {
            firstToLoad = ancestor;
            result = applyToNode(result, ancestor, (n) => ({ ...n, isLoading: true }));
            break;
          }
        }
      }

      if (result !== current) {
        nodesRef.current = result;
        setNodesRaw(result);
      }

      if (firstToLoad) {
        const loadPath = firstToLoad;
        loadDirEntries(loadPath)
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
    [setNodesRaw],
  );

  useEffect(() => {
    expandToPathRef.current = expandToPath;
  }, [expandToPath]);

  // Auto-reveal currentPath in tree when it changes
  useEffect(() => {
    expandToPath(currentPath);
  }, [currentPath, expandToPath]);

  // Refresh stale children of currentPath when right pane reloads
  const prevRefreshTriggerRef = useRef(0);
  useEffect(() => {
    if (!refreshTrigger || refreshTrigger === prevRefreshTriggerRef.current) return;
    prevRefreshTriggerRef.current = refreshTrigger;

    const node = findNode(nodesRef.current, currentPath);
    if (!node || !node.isDirectory) return;

    if (node.isExpanded) {
      setNodes((prev) => applyToNode(prev, currentPath, (n) => ({ ...n, isLoading: true })));
      loadDirEntries(currentPath)
        .then((entries) => {
          setNodes((prev) =>
            applyToNode(prev, currentPath, (n) => ({
              ...n,
              isLoading: false,
              children: entries,
            })),
          );
        })
        .catch(() => {
          setNodes((prev) => applyToNode(prev, currentPath, (n) => ({ ...n, isLoading: false })));
        });
    } else {
      // Invalidate cache so it refetches on next expand
      setNodes((prev) => applyToNode(prev, currentPath, (n) => ({ ...n, children: null })));
    }
  }, [refreshTrigger, currentPath, setNodes]);

  // Toggle expand/collapse with lazy loading (dirs only)
  const handleToggle = useCallback(
    (path: string) => {
      let shouldLoad = false;

      setNodes((prev) => {
        const node = findNode(prev, path);
        if (!node || !node.isDirectory || node.isLoading) return prev;

        if (node.isExpanded) {
          return applyToNode(prev, path, (n) => ({ ...n, isExpanded: false }));
        }
        if (node.children !== null) {
          return applyToNode(prev, path, (n) => ({ ...n, isExpanded: true }));
        }

        shouldLoad = true;
        return applyToNode(prev, path, (n) => ({ ...n, isLoading: true }));
      });

      if (!shouldLoad) return;

      loadDirEntries(path)
        .then((entries) => {
          setNodes((prev) =>
            applyToNode(prev, path, (n) => ({
              ...n,
              isLoading: false,
              isExpanded: true,
              children: entries,
            })),
          );
        })
        .catch(() => {
          setNodes((prev) => applyToNode(prev, path, (n) => ({ ...n, isLoading: false })));
        });
    },
    [setNodes],
  );

  return (
    <ScrollArea className="h-full w-full">
      <div role="tree" aria-label="Device filesystem" className="py-1 pr-1">
        {nodes.map((node) => (
          <TreeRow
            key={node.path}
            node={node}
            depth={0}
            currentPath={currentPath}
            onSelect={onNavigate}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
