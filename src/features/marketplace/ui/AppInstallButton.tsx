import { Check, Download, ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { backend } from '@/desktop/models';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { installMarketplacePackage } from '@/features/marketplace/utils/install';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { cn } from '@/shared/utils/cn';

type MarketplaceApp = backend.MarketplaceApp;
type InstallState = 'idle' | 'running' | 'done';

const DONE_RESET_MS = 2000;

interface AppInstallButtonProps {
  app: MarketplaceApp;
  onSelect: (app: MarketplaceApp) => void;
  target: InstallTarget;
}

/**
 * The one install control shared by the grid card and the list row.
 *
 * Disabled with a reason when no device can receive the APK — previously the
 * button was enabled regardless and the download ran before failing.
 */
export function AppInstallButton({ app, onSelect, target }: AppInstallButtonProps) {
  const [installState, setInstallState] = useState<InstallState>('idle');
  const isInstallable = Boolean(app.downloadUrl);
  const isBlocked = isInstallable && !target.canInstall;

  const handleClick = async (event: React.MouseEvent) => {
    event.stopPropagation();

    if (!app.downloadUrl) {
      onSelect(app);
      return;
    }

    try {
      setInstallState('running');
      await installMarketplacePackage(app.name, app.downloadUrl);
      setInstallState('done');
      setTimeout(() => {
        setInstallState('idle');
      }, DONE_RESET_MS);
    } catch {
      setInstallState('idle');
    }
  };

  const label = (() => {
    if (installState === 'running') {
      return 'Installing…';
    }
    if (installState === 'done') {
      return 'Installed';
    }
    return isInstallable ? 'Install' : 'Details';
  })();

  const button = (
    <Button
      aria-label={isInstallable ? `Install ${app.name}` : `View details for ${app.name}`}
      className={cn('shrink-0', installState === 'done' && 'pointer-events-none')}
      disabled={installState === 'running' || isBlocked}
      onClick={(event) => {
        void handleClick(event);
      }}
      size="sm"
      type="button"
      variant={installState === 'done' ? 'default' : 'outline'}
    >
      {installState === 'done' ? (
        <Check aria-hidden="true" />
      ) : installState === 'running' ? (
        <Loader2 aria-hidden="true" className="animate-spin" />
      ) : isInstallable ? (
        <Download aria-hidden="true" />
      ) : (
        <ExternalLink aria-hidden="true" />
      )}
      {label}
    </Button>
  );

  if (!(isBlocked && target.blockedReason)) {
    return button;
  }

  return (
    <Tooltip>
      {/* A disabled button swallows pointer events, so the trigger wraps it. */}
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72" side="top">
        {target.blockedReason}
      </TooltipContent>
    </Tooltip>
  );
}
