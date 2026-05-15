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
            'size-11',
            rootAccessGranted && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
          )}
          disabled={disabled}
          onClick={() => {
            void onToggle();
          }}
          size="icon"
          variant="ghost"
        >
          {rootAccessGranted ? <ShieldCheck className="size-4" /> : <Shield className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
