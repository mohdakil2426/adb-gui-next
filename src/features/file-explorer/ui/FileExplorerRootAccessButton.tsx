import { Shield, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';

interface Props {
  disabled: boolean;
  onToggle: () => Promise<void>;
  rootAccessGranted: boolean;
}

export function FileExplorerRootAccessButton({ disabled, onToggle, rootAccessGranted }: Props) {
  const label = rootAccessGranted ? 'Disable root access' : 'Enable root access';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={rootAccessGranted}
          className={cn(
            'size-8 shrink-0',
            rootAccessGranted &&
              'text-destructive hover:bg-destructive-muted hover:text-destructive',
          )}
          disabled={disabled}
          onClick={() => {
            void onToggle();
          }}
          size="icon-sm"
          variant="ghost"
        >
          {rootAccessGranted ? (
            <ShieldCheck aria-hidden="true" className="size-4" data-icon="inline-start" />
          ) : (
            <Shield aria-hidden="true" className="size-4" data-icon="inline-start" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
