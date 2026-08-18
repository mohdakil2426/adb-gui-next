import { Check, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { backend } from '@/desktop/models';

interface PackagePermissionsManagerProps {
  info: backend.DetailedPackageInfo;
}

export function PackagePermissionsManager({ info }: PackagePermissionsManagerProps) {
  const granted = info.grantedPermissions || [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-emerald-500" />
          <h4 className="font-medium text-foreground text-label">Granted Permissions</h4>
        </div>
        <span className="numeric text-caption text-muted-foreground">{granted.length} active</span>
      </div>

      {granted.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-caption text-muted-foreground italic">
          <ShieldAlert className="size-4" />
          <span>No specific runtime permissions declared</span>
        </div>
      ) : (
        <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto pr-1">
          {granted.map((perm: string) => {
            const shortName = perm.split('.').pop() || perm;
            return (
              <div
                className="flex items-center justify-between rounded border border-border/70 bg-surface-raised/40 px-2 py-1 text-caption"
                key={perm}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <Check className="size-3.5 shrink-0 text-emerald-500" />
                  <span className="truncate font-mono text-foreground">{shortName}</span>
                </div>
                <span className="shrink-0 font-mono text-muted-foreground">
                  {perm.split('.')[1]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
