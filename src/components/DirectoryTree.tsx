import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Loader2 } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ListFiles } from '@/lib/desktop/backend';
import { cn } from '@/lib/utils';

interface TreeNode {
  children: TreeNode[] | null; // null = not yet loaded (dirs only)
  isDirectory: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  name: string;
  path: string;
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
  return {
    path,
    name,
    isDirectory,
    isExpanded: false,
    children: null,
    isLoading: false,
  };
}

function applyToNode(
  nodes: TreeNode[],
  targetPath: string,
  updater: (n: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return updater(node);
    }
    if (node.children) {
      return {
        ...node,
        children: applyToNode(node.children, targetPath, updater),
      };
    }
    return node;
  });
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

/** Load all entries (files + dirs) for a path and return as TreeNode[]. */
function loadDirEntries(path: string, serial?: string | null): Promise<TreeNode[]> {
  return ListFiles(path, serial).then((entries) =>
    entries
      .sort((a, b) => {
        const aIsDir = a.type === 'Directory' || a.type === 'Symlink';
        const bIsDir = b.type === 'Directory' || b.type === 'Symlink';
        if (aIsDir && !bIsDir) {
          return -1;
        }
        if (!aIsDir && bIsDir) {
          return 1;
        }
        return a.name.localeCompare(b.name);
      })
      .map((e) => {
        const isDir = e.type === 'Directory' || e.type === 'Symlink';
        return makeNode(isDir ? `${path}${e.name}/` : `${path}${e.name}`, e.name, isDir);
      }),
  );
}

interface TreeRowProps {
  currentPath: string;
  depth: number;
  node: TreeNode;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
}

function TreeRow({ node, depth, currentPath, onSelect, onToggle }: TreeRowProps) {
  const isActive = currentPath === node.path || currentPath === `${node.path}/`;
  const isAncestor = !isActive && node.isDirectory && currentPath.startsWith(node.path);

  return (
    <>
      <div
        aria-expanded={node.isDirectory ? node.isExpanded : undefined}
        aria-selected={isActive}
        className={cn(
          'flex cursor-pointer select-none items-center gap-2 rounded-sm py-[3px] text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isActive && 'bg-accent font-medium text-accent-foreground',
          isAncestor && 'text-foreground',
          !(isActive || isAncestor) && 'text-muted-foreground',
        )}
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
        role="treeitem"
        style={{ paddingLeft: `${depth * 14 + 6}px`, paddingRight: '6px' }}
        tabIndex={0}
      >
        {/* Expand chevron — only for directories */}
        <span
          className="flex size-4 shrink-0 items-center justify-center"
          onClick={
            node.isDirectory
              ? (e: React.MouseEvent) => {
                  e.stopPropagation();
                  onToggle(node.path);
                }
              : undefined
          }
        >
          {node.isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : node.isDirectory ? (
            node.isExpanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4 opacity-50" />
            )
          ) : (
            <span className="size-4" /> // spacer for file alignment
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
      {node.isDirectory && node.children !== null ? (
        <div
          className={cn(
            'overflow-hidden transition-all duration-200 ease-in-out',
            node.isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          {node.children.length === 0 ? (
            <div
              className="py-1 text-muted-foreground text-xs italic"
              style={{ paddingLeft: `${(depth + 1) * 14 + 28}px` }}
            >
              Empty
            </div>
          ) : (
            node.children.map((child) => (
              <TreeRow
                currentPath={currentPath}
                depth={depth + 1}
                key={child.path}
                node={child}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            ))
          )}
        </div>
      ) : null}
    </>
  );
}

export interface DirectoryTreeProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  /** Increment to force-refresh the tree node for currentPath. */
  refreshTrigger?: number;
  serial?: string | null;
}

export function DirectoryTree({
  currentPath,
  onNavigate,
  refreshTrigger,
  serial,
}: DirectoryTreeProps) {
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
        if (!(node && node.isDirectory) || node.isLoading) {
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
        loadDirEntries(loadPath, serial)
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

  // Refresh stale children of currentPath when right pane reloads
  const prevRefreshTriggerRef = useRef(0);
  useEffect(() => {
    if (!refreshTrigger || refreshTrigger === prevRefreshTriggerRef.current) {
      return;
    }
    prevRefreshTriggerRef.current = refreshTrigger;

    const node = findNode(nodesRef.current, currentPath);
    if (!node?.isDirectory) {
      return;
    }

    if (node.isExpanded) {
      setNodes((prev) => applyToNode(prev, currentPath, (n) => ({ ...n, isLoading: true })));
      loadDirEntries(currentPath, serial)
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
  }, [refreshTrigger, currentPath, serial, setNodes]);

  // Toggle expand/collapse with lazy loading (dirs only)
  const handleToggle = useCallback(
    (path: string) => {
      let shouldLoad = false;

      setNodes((prev) => {
        const node = findNode(prev, path);
        if (!(node && node.isDirectory) || node.isLoading) {
          return prev;
        }

        if (node.isExpanded) {
          return applyToNode(prev, path, (n) => ({ ...n, isExpanded: false }));
        }
        if (node.children !== null) {
          return applyToNode(prev, path, (n) => ({ ...n, isExpanded: true }));
        }

        shouldLoad = true;
        return applyToNode(prev, path, (n) => ({ ...n, isLoading: true }));
      });

      if (!shouldLoad) {
        return;
      }

      loadDirEntries(path, serial)
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
    [serial, setNodes],
  );

  return (
    <ScrollArea className="h-full w-full">
      <div aria-label="Device filesystem" className="py-1 pr-1" role="tree">
        {nodes.map((node) => (
          <TreeRow
            currentPath={currentPath}
            depth={0}
            key={node.path}
            node={node}
            onSelect={onNavigate}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
