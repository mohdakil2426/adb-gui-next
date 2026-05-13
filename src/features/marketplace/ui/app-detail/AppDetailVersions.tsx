import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { formatDisplayDate, formatFileSize } from '@/shared/utils/formatting';

interface AppVersion {
  downloadUrl?: string | null;
  publishedAt?: string | null;
  size?: number | null;
  versionName: string;
}

interface AppDetailVersionsProps {
  activeVersionName: string | null;
  isPrimaryInstalling: boolean;
  onInstallVersion: (versionName: string, downloadUrl: string) => void;
  versions: AppVersion[];
}

export function AppDetailVersions({
  versions,
  activeVersionName,
  isPrimaryInstalling,
  onInstallVersion,
}: AppDetailVersionsProps) {
  return (
    <section className="gap-4">
      <h3 className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">
        Recent Versions
      </h3>
      <div className="gap-3">
        {versions.slice(0, 5).map((version) => {
          const isInstallingVersion = activeVersionName === version.versionName;
          return (
            <div
              className="flex flex-col gap-2 rounded-xl border bg-muted/10 p-3"
              key={version.versionName}
            >
              <div className="flex items-center justify-between">
                <span className="truncate font-medium text-sm">{version.versionName}</span>
                {version.publishedAt ? (
                  <span className="text-muted-foreground text-xs">
                    {formatDisplayDate(version.publishedAt)}
                  </span>
                ) : null}
              </div>
              {version.downloadUrl ? (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">
                    {version.size == null ? 'APK' : formatFileSize(version.size)}
                  </span>
                  <Button
                    className="h-7 px-3 text-xs"
                    disabled={isInstallingVersion || isPrimaryInstalling}
                    onClick={() => {
                      const url = version.downloadUrl;
                      if (url) {
                        onInstallVersion(version.versionName, url);
                      }
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    {isInstallingVersion ? (
                      <Loader2
                        aria-hidden="true"
                        className="animate-spin"
                        data-icon="inline-start"
                      />
                    ) : (
                      <Download aria-hidden="true" data-icon="inline-start" />
                    )}
                    Install
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
