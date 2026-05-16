import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { VIEWS, type ViewType } from '@/app/shell/viewConfig';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { cn } from '@/shared/utils/cn';

interface ViewContentProps {
  activeView: ViewType;
  mainPaddingBottom: string | undefined;
  renderContent: (view: ViewType) => ReactNode;
}

export function ViewContent({ activeView, mainPaddingBottom, renderContent }: ViewContentProps) {
  const isFileExplorerView = activeView === VIEWS.FILES;

  return (
    <div
      className={cn(
        'custom-scroll main-scroll-area flex-1 overflow-x-hidden',
        isFileExplorerView ? 'overflow-hidden' : 'overflow-y-auto',
      )}
      id="main-content"
      role="main"
      style={{ paddingBottom: mainPaddingBottom }}
      tabIndex={-1}
    >
      <div
        className={cn(
          'flex w-full flex-col p-4 sm:p-6',
          isFileExplorerView ? 'h-full min-h-0' : 'min-h-full',
        )}
      >
        <div className="mx-auto flex min-h-0 w-full max-w-(--content-max-width) flex-1 flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              animate={{ opacity: 1 }}
              className="flex min-h-0 w-full flex-1 flex-col"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              key={activeView}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <ErrorBoundary key={activeView} viewName={activeView}>
                {renderContent(activeView)}
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
