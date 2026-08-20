import { Copy, FileCode, Folder } from 'lucide-react';
import { toast } from 'sonner';
import type { backend } from '@/desktop/models';
import { Button } from '@/shared/ui/button';

interface PackageStorageBreakdownProps {
  info: backend.DetailedPackageInfo;
}
function copyText(val: string, label: string) {
  navigator.clipboard.writeText(val);
  toast.success(`Copied ${label}`);
}

export function PackageStorageBreakdown({ info }: PackageStorageBreakdownProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <h4 className="font-medium text-foreground text-label">Storage & File Locations</h4>

      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
              <FileCode className="size-3.5" />
              <span>Base APK Code Path</span>
            </div>
            <Button
              aria-label="Copy APK Path"
              className="size-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => copyText(info.apkPath, 'APK Path')}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Copy aria-hidden="true" className="size-3" data-icon="inline-start" />
            </Button>
          </div>
          <span className="break-all font-mono text-caption text-foreground">
            {info.apkPath || 'Not available'}
          </span>
        </div>

        <div className="flex flex-col gap-1 rounded-md border border-border bg-surface-raised p-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
              <Folder className="size-3.5" />
              <span>Data Directory</span>
            </div>
            <Button
              aria-label="Copy Data Directory Path"
              className="size-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => copyText(info.dataDir, 'Data Path')}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Copy aria-hidden="true" className="size-3" data-icon="inline-start" />
            </Button>
          </div>
          <span className="break-all font-mono text-caption text-foreground">
            {info.dataDir || 'Not available'}
          </span>
        </div>
        {info.installer ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-surface-raised p-2 text-caption">
            <span className="text-muted-foreground">Installed By</span>
            <span className="font-medium text-foreground">{info.installer}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
