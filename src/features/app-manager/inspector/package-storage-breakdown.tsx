import { Copy, FileCode, Folder } from "lucide-react";
import { toast } from "sonner";

import type { backend } from "@/desktop/models";
import { Button } from "@/shared/ui/button";

interface PackageStorageBreakdownProps {
  info: backend.DetailedPackageInfo;
}
const copyText = (val: string, label: string) => {
  navigator.clipboard.writeText(val);
  toast.success(`Copied ${label}`);
};

export const PackageStorageBreakdown = ({ info }: PackageStorageBreakdownProps) => (
  <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-3">
    <h4 className="text-foreground text-label font-medium">Storage & File Locations</h4>

    <div className="flex flex-col gap-2">
      <div className="border-border bg-surface-raised flex flex-col gap-1 rounded-md border p-2">
        <div className="flex items-center justify-between">
          <div className="text-caption text-muted-foreground flex items-center gap-1.5">
            <FileCode className="size-3.5" />
            <span>Base APK Code Path</span>
          </div>
          <Button
            aria-label="Copy APK Path"
            className="text-muted-foreground hover:text-foreground size-6 p-0"
            onClick={() => copyText(info.apkPath, "APK Path")}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Copy aria-hidden="true" className="size-3" data-icon="inline-start" />
          </Button>
        </div>
        <span className="text-caption text-foreground font-mono break-all">
          {info.apkPath || "Not available"}
        </span>
      </div>

      <div className="border-border bg-surface-raised flex flex-col gap-1 rounded-md border p-2">
        <div className="flex items-center justify-between">
          <div className="text-caption text-muted-foreground flex items-center gap-1.5">
            <Folder className="size-3.5" />
            <span>Data Directory</span>
          </div>
          <Button
            aria-label="Copy Data Directory Path"
            className="text-muted-foreground hover:text-foreground size-6 p-0"
            onClick={() => copyText(info.dataDir, "Data Path")}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Copy aria-hidden="true" className="size-3" data-icon="inline-start" />
          </Button>
        </div>
        <span className="text-caption text-foreground font-mono break-all">
          {info.dataDir || "Not available"}
        </span>
      </div>
      {info.installer ? (
        <div className="border-border bg-surface-raised text-caption flex items-center justify-between rounded-md border p-2">
          <span className="text-muted-foreground">Installed By</span>
          <span className="text-foreground font-medium">{info.installer}</span>
        </div>
      ) : null}
    </div>
  </div>
);
