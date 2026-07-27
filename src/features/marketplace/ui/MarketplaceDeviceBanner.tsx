import { Info, Smartphone } from 'lucide-react';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';

/**
 * Says up front where an APK would land, or why nothing can be installed.
 *
 * Without this the Marketplace looked fully functional with no device attached
 * and only reported the truth in a failure toast after a completed download.
 */
export function MarketplaceDeviceBanner({ target }: { target: InstallTarget }) {
  if (target.canInstall) {
    return (
      <p className="flex items-center gap-2 text-caption text-muted-foreground">
        <Smartphone aria-hidden="true" className="size-3.5 shrink-0 text-success" />
        Installs go to <span className="font-mono text-foreground text-mono">{target.serial}</span>
      </p>
    );
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-muted px-3 py-2">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-medium text-body text-foreground">Installing is unavailable</p>
        <p className="text-body text-muted-foreground">{target.blockedReason}</p>
      </div>
    </div>
  );
}
