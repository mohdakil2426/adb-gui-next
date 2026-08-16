import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { formatBytes, formatDisplayDate } from '@/shared/utils/format';

interface AppVersion {
  downloadUrl?: string | null;
  publishedAt?: string | null;
  size?: number | null;
  versionName: string;
}

interface AppDetailVersionsProps {
  activeVersionName: string | null;
  /** Mirrors the hero: no reachable device means no install here either. */
  canInstall: boolean;
  isPrimaryInstalling: boolean;
  onInstallVersion: (versionName: string, downloadUrl: string) => void;
  versions: AppVersion[];
}

export function AppDetailVersions({
  activeVersionName,
  canInstall,
  isPrimaryInstalling,
  onInstallVersion,
  versions,
}: AppDetailVersionsProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-caption text-muted-foreground uppercase tracking-wide">
        All APK releases
      </h2>
      <div className="flex max-h-80 min-h-0 flex-col gap-1.5 overflow-y-auto">
        {versions.map((version) => {
          const isInstallingVersion = activeVersionName === version.versionName;
          return (
            <div
              className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-raised p-2.5"
              key={version.downloadUrl ?? version.versionName}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-body text-foreground">
                  {version.versionName}
                </span>
                {version.publishedAt ? (
                  <span className="numeric shrink-0 text-caption text-muted-foreground">
                    {formatDisplayDate(version.publishedAt)}
                  </span>
                ) : null}
              </div>
              {version.downloadUrl ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="numeric text-caption text-muted-foreground">
                    {version.size == null ? 'APK' : formatBytes(version.size)}
                  </span>
                  <Button
                    aria-label={`Install version ${version.versionName}`}
                    disabled={!canInstall || isInstallingVersion || isPrimaryInstalling}
                    onClick={() => {
                      const url = version.downloadUrl;
                      if (url) {
                        onInstallVersion(version.versionName, url);
                      }
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {isInstallingVersion ? (
                      <Loader2 aria-hidden="true" className="animate-spin" />
                    ) : (
                      <Download aria-hidden="true" />
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
