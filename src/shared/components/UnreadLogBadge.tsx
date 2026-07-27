import { useLogStore } from '@/shared/stores/logStore';

const MAX_DISPLAYED = 99;

/**
 * Isolated subscriber for the unread-log counter.
 *
 * `logStore.unreadCount` increments on *every* log line while the panel is closed
 * (the default), and there are ~100 log-emitting call sites. Subscribing to it from
 * `MainLayout` re-rendered the entire application tree — header, sidebar, bottom
 * panel and the whole active view — once per log line. Keeping the subscription in
 * this leaf confines that to a 16px badge.
 */
export function UnreadLogBadge() {
  const unreadCount = useLogStore((state) => state.unreadCount);
  const isOpen = useLogStore((state) => state.isOpen);

  if (isOpen || unreadCount === 0) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-semibold text-caption text-destructive-foreground tabular-nums leading-none"
    >
      {unreadCount > MAX_DISPLAYED ? `${MAX_DISPLAYED}+` : unreadCount}
    </span>
  );
}

/** Screen-reader announcement for the same counter, kept out of `MainLayout`. */
export function UnreadLogAnnouncer() {
  const unreadCount = useLogStore((state) => state.unreadCount);
  const isOpen = useLogStore((state) => state.isOpen);
  const pending = isOpen ? 0 : unreadCount;

  return (
    <span aria-live="polite" className="sr-only">
      {pending > 0 ? `${pending} new log${pending === 1 ? '' : 's'}` : ''}
    </span>
  );
}
