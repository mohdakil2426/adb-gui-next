import { Check, ShieldAlert, ShieldCheck } from "lucide-react";

import type { backend } from "@/desktop/models";

interface PackagePermissionsManagerProps {
  info: backend.DetailedPackageInfo;
}

export const PackagePermissionsManager = ({ info }: PackagePermissionsManagerProps) => {
  const granted = info.grantedPermissions || [];

  return (
    <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-emerald-500" />
          <h4 className="text-foreground text-label font-medium">Granted Permissions</h4>
        </div>
        <span className="numeric text-caption text-muted-foreground">{granted.length} active</span>
      </div>

      {granted.length === 0 ? (
        <div className="text-caption text-muted-foreground flex items-center gap-2 py-2 italic">
          <ShieldAlert className="size-4" />
          <span>No specific runtime permissions declared</span>
        </div>
      ) : (
        <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto pr-1">
          {granted.map((perm: string) => {
            const shortName = perm.split(".").pop() || perm;
            return (
              <div
                className="border-border/70 bg-surface-raised/40 text-caption flex items-center justify-between rounded border px-2 py-1"
                key={perm}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <Check className="size-3.5 shrink-0 text-emerald-500" />
                  <span className="text-foreground truncate font-mono">{shortName}</span>
                </div>
                <span className="text-muted-foreground shrink-0 font-mono">
                  {perm.split(".")[1]}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
