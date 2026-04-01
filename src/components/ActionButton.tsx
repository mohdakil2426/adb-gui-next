import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, type LucideIcon } from 'lucide-react';

export interface ActionButtonProps {
  actionId: string;
  icon: LucideIcon;
  label: string;
  sentLabel?: string;
  loadingAction: string | null;
  sentAction: string | null;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  tall?: boolean;
  className?: string;
  wrapperClassName?: string;
  justifyStart?: boolean;
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
      variant={variant}
      className={cn(
        'w-full active:scale-[0.97] transition-all duration-200',
        tall ? 'h-20 flex flex-col items-center justify-center gap-2' : 'gap-2',
        justifyStart && 'justify-start pl-4',
        isSent &&
          'ring-2 ring-success/50 shadow-[0_0_12px_color-mix(in_oklch,var(--success)_40%,transparent)]',
        className,
        wrapperClassName,
      )}
      onClick={onClick}
      disabled={isDisabled}
    >
      <AnimatePresence mode="wait">
        {isSent ? (
          <motion.div
            key="check"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className={tall ? '' : 'shrink-0'}
          >
            <Check className={cn('text-success', tall ? 'h-5 w-5' : 'h-4 w-4 mr-2')} />
          </motion.div>
        ) : isLoading ? (
          <motion.div
            key="spin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={tall ? '' : 'shrink-0'}
          >
            <Loader2 className={cn('animate-spin', tall ? 'h-5 w-5' : 'h-4 w-4 mr-2')} />
          </motion.div>
        ) : (
          <motion.div
            key="icon"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={tall ? '' : 'shrink-0'}
          >
            <Icon className={cn(tall ? 'h-5 w-5' : 'h-4 w-4 mr-2')} />
          </motion.div>
        )}
      </AnimatePresence>
      {isSent ? sentLabel : label}
    </Button>
  );
}
