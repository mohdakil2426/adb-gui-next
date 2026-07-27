import { AnimatePresence, m } from 'framer-motion';
import { memo, type ReactNode, Suspense } from 'react';
import { VIEWS, type ViewType } from '@/app/shell/viewConfig';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { cn } from '@/shared/utils/cn';

interface ViewContentProps {
  activeView: ViewType;
  renderContent: (view: ViewType) => ReactNode;
}

/**
 * Shown while a lazily-loaded view chunk resolves. Chunks are served from the
 * local Tauri asset protocol, so this is usually a single frame — it exists to
 * hold layout rather than to be read.
 */
function ViewFallback() {
  return (
    <output aria-label="Loading view" className="flex flex-1 flex-col gap-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />
      <div className="h-32 w-full animate-pulse rounded-lg bg-muted" />
    </output>
  );
}

function ViewContentImpl({ activeView, renderContent }: ViewContentProps) {
  const isFileExplorerView = activeView === VIEWS.FILES;
  const isMarketplaceView = activeView === VIEWS.MARKETPLACE;

  return (
    <main
      className={cn(
        'custom-scroll main-scroll-area min-h-0 flex-1 overflow-x-hidden',
        isFileExplorerView || isMarketplaceView ? 'overflow-hidden' : 'overflow-y-auto',
      )}
      id="main-content"
      tabIndex={-1}
    >
      <div
        className={cn(
          'flex w-full flex-col p-5',
          isFileExplorerView || isMarketplaceView ? 'h-full min-h-0' : 'min-h-full',
        )}
      >
        {/* Fluid width: the old 1280px cap centred content on a desktop app that
            users run maximised on 27" displays.
            `@container`: the window is never narrower than `--breakpoint-lg` (see
            tauri.conf.json minWidth), so viewport breakpoints inside a view are
            permanently on. This box is the real, sidebar-aware content area — the
            actual quantity every per-view `@sm:`/`@lg:`/etc. container query below
            should measure instead. */}
        <div className="@container flex min-h-0 w-full flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            <m.div
              animate={{ opacity: 1 }}
              className="flex min-h-0 w-full flex-1 flex-col"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key={activeView}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <ErrorBoundary key={activeView} viewName={activeView}>
                <Suspense fallback={<ViewFallback />}>{renderContent(activeView)}</Suspense>
              </ErrorBoundary>
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

/**
 * Memoized: `MainLayout` re-renders on unrelated shell state (panel height, log
 * counters), and without this every such render re-rendered the entire active view.
 * Requires `renderContent` to be a stable module-level reference.
 */
export const ViewContent = memo(ViewContentImpl);
