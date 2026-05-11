import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ActionButtonProps {
  actionId: string;
  className?: string;
  disabled?: boolean;
  icon: LucideIcon;
  justifyStart?: boolean;
  label: string;
  loadingAction: string | null;
  onClick: () => void;
  sentAction: string | null;
  sentLabel?: string;
  tall?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  wrapperClassName?: string;
}

export function ActionButton({
  actionId,
  icon: Icon,
  label,
  sentLabel = 'Sent!',
  loadingAction,
  sentAction,
  onClick,
  disabled = false,
  variant = 'outline',
  tall = false,
  className,
  wrapperClassName,
  justifyStart = false,
}: ActionButtonProps) {
  const isLoading = loadingAction === actionId;
  const isSent = sentAction === actionId;

  // We consider it disabled if explicitly disabled, or if ANY action is currently loading/sent
  const isGlobalLoadingOrSent = loadingAction !== null || sentAction !== null;
  const isDisabled = disabled || isGlobalLoadingOrSent;

  return (
    <Button
      className={cn(
        'w-full transition-all duration-200 active:scale-[0.97]',
        tall ? 'flex h-20 flex-col items-center justify-center gap-2' : 'gap-2',
        justifyStart && 'justify-start pl-4',
        isSent &&
          'shadow-[0_0_12px_color-mix(in_oklch,var(--success)_40%,transparent)] ring-2 ring-success/50',
        className,
        wrapperClassName,
      )}
      disabled={isDisabled}
      onClick={onClick}
      variant={variant}
    >
      <AnimatePresence mode="wait">
        {isSent ? (
          <motion.div
            animate={{ scale: 1 }}
            className={tall ? '' : 'shrink-0'}
            exit={{ scale: 0 }}
            initial={{ scale: 0 }}
            key="check"
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <Check className={cn('text-success', tall ? 'size-5' : 'mr-2 size-4')} />
          </motion.div>
        ) : isLoading ? (
          <motion.div
            animate={{ opacity: 1 }}
            className={tall ? '' : 'shrink-0'}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="spin"
          >
            <Loader2 className={cn('animate-spin', tall ? 'size-5' : 'mr-2 size-4')} />
          </motion.div>
        ) : (
          <motion.div
            animate={{ opacity: 1 }}
            className={tall ? '' : 'shrink-0'}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="icon"
          >
            <Icon className={cn(tall ? 'size-5' : 'mr-2 size-4')} />
          </motion.div>
        )}
      </AnimatePresence>
      {isSent ? sentLabel : label}
    </Button>
  );
}
