import { AnimatePresence, m } from 'framer-motion';
import { Check, Loader2, type LucideIcon } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/utils/cn';

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
  className,
  wrapperClassName,
  justifyStart = false,
}: ActionButtonProps) {
  const isLoading = loadingAction === actionId;
  const isSent = sentAction === actionId;

  // Disabled while *some* action is in flight. `sentAction` is a post-success
  // confirmation that lingers for 2s — it must not take the whole panel with it.
  const isDisabled = disabled || loadingAction !== null;

  return (
    <Button
      className={cn(
        // `transition-colors`, not `transition-all`: the token file allows only
        // transform/opacity to animate. The "sent" state is a ring, not an outer
        // glow — the glow rendered as a dirty halo on the light surface.
        'w-full gap-2 transition-colors active:scale-[0.97]',
        justifyStart && 'justify-start pl-4',
        isSent && 'ring-2 ring-success',
        className,
        wrapperClassName,
      )}
      disabled={isDisabled}
      onClick={onClick}
      variant={variant}
    >
      <AnimatePresence mode="wait">
        {isSent ? (
          <m.div
            animate={{ scale: 1 }}
            className="shrink-0"
            exit={{ scale: 0.95, opacity: 0 }}
            initial={{ scale: 0.95, opacity: 0 }}
            key="check"
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <Check className="mr-2 size-4 text-success" />
          </m.div>
        ) : isLoading ? (
          <m.div
            animate={{ opacity: 1 }}
            className="shrink-0"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="spin"
          >
            <Loader2 className="mr-2 size-4 animate-spin" />
          </m.div>
        ) : (
          <m.div
            animate={{ opacity: 1 }}
            className="shrink-0"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="icon"
          >
            <Icon className="mr-2 size-4" />
          </m.div>
        )}
      </AnimatePresence>
      {isSent ? sentLabel : label}
    </Button>
  );
}
