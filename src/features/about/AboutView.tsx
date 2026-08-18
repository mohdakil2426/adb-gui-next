import { Cpu, ExternalLink, Heart, Package, Scale } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrowserOpenURL } from '@/desktop/runtime';
import { usePlatformToolVersions } from '@/features/about/hooks/usePlatformToolVersions';
import {
  APP_COPYRIGHT,
  APP_LICENSE,
  APP_NAME,
  APP_VERSION,
  buildTarget,
  CREDITS,
  ISSUES_URL,
  LICENSE_URL,
  RELEASES_URL,
  REPOSITORY_URL,
} from '@/features/about/model/appInfo';
import { AboutCard } from '@/features/about/ui/AboutCard';
import { ExternalLinkButton } from '@/features/about/ui/ExternalLinkButton';
import { Badge } from '@/shared/ui/badge';
import { Skeleton } from '@/shared/ui/skeleton';

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-body">
      <dt className="shrink-0 text-label text-muted-foreground">{label}</dt>
      <dd className="numeric min-w-0 truncate text-right font-mono text-foreground text-mono">
        {value}
      </dd>
    </div>
  );
}

export function ViewAbout() {
  const target = buildTarget();
  const { data: tools, isLoading: isLoadingTools } = usePlatformToolVersions();

  const toolValue = (value: string | null | undefined) => {
    if (isLoadingTools) {
      return <Skeleton className="ml-auto h-4 w-20" />;
    }
    return value ?? 'not detected';
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="sr-only">About {APP_NAME}</h1>

      {/* Hero Header Section */}
      <section className="flex @lg:flex-row flex-col @lg:items-center @lg:justify-between gap-4 rounded-lg border border-border bg-surface p-4 shadow-none">
        <div className="flex items-center gap-3.5">
          <img
            alt={`${APP_NAME} logo`}
            className="size-12 shrink-0 object-contain"
            height={48}
            src="/logo.png"
            width={48}
          />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground text-title">{APP_NAME}</span>
            <p className="max-w-xl text-body text-muted-foreground">
              A desktop front end for adb and fastboot: inspect a device, move files, manage apps,
              flash partitions and unpack firmware — without memorising command lines.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge className="numeric font-mono text-[11px]" variant="secondary">
            v{APP_VERSION}
          </Badge>
          {target.isDebug ? <Badge variant="warning">Development build</Badge> : null}
        </div>
      </section>

      {/* Top Grid: Build + Licence (Equal Stretched Height) */}
      <div className="grid @3xl:grid-cols-2 grid-cols-1 items-stretch gap-4">
        {/* Build Card */}
        <AboutCard icon={Cpu} title="Build">
          <dl className="flex flex-col divide-y divide-border">
            <DetailRow label="Version" value={`v${APP_VERSION}`} />
            <DetailRow label="Platform" value={`${target.platform} · ${target.arch}`} />
            {target.triple ? <DetailRow label="Target triple" value={target.triple} /> : null}
            <DetailRow label="Bundled adb" value={toolValue(tools?.adb)} />
            <DetailRow label="Bundled fastboot" value={toolValue(tools?.fastboot)} />
          </dl>
          <p className="text-caption text-muted-foreground">
            adb and fastboot ship inside the app, so nothing has to be installed separately or put
            on PATH.
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <ExternalLinkButton url={RELEASES_URL}>Release notes</ExternalLinkButton>
            <ExternalLinkButton url={ISSUES_URL} variant="ghost">
              Report a problem
            </ExternalLinkButton>
          </div>
        </AboutCard>

        {/* Licence Card */}
        <AboutCard icon={Scale} title="Licence">
          <dl className="flex flex-col divide-y divide-border">
            <DetailRow label="Licence" value={<Badge variant="secondary">{APP_LICENSE}</Badge>} />
            <DetailRow label="Copyright" value={APP_COPYRIGHT} />
          </dl>
          <p className="text-body text-muted-foreground">
            Released under the MIT licence: use it, modify it and redistribute it, including
            commercially, as long as the copyright notice travels with it. It comes with no
            warranty.
          </p>
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <ExternalLinkButton url={REPOSITORY_URL}>Source code</ExternalLinkButton>
            <ExternalLinkButton url={LICENSE_URL} variant="ghost">
              Full licence text
            </ExternalLinkButton>
          </div>
        </AboutCard>

        {/* Full-Width Built With Grid */}
        <AboutCard className="@3xl:col-span-2" icon={Package} title="Built with">
          <div className="grid @4xl:grid-cols-3 @lg:grid-cols-2 grid-cols-1 gap-2.5">
            {CREDITS.map((credit) => (
              <button
                className="group flex cursor-pointer flex-col justify-between gap-2 rounded-lg border border-border bg-surface-raised/40 p-3 text-left transition-all duration-150 hover:border-border hover:bg-surface-raised"
                key={credit.name}
                onClick={() => BrowserOpenURL(credit.url)}
                type="button"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-body text-foreground transition-colors group-hover:text-foreground">
                    {credit.name}
                  </span>
                  <ExternalLink className="size-3 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
                </div>
                <span className="text-caption text-muted-foreground">{credit.role}</span>
                <div className="pt-0.5">
                  <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {credit.license}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-caption text-muted-foreground">
            <Heart aria-hidden="true" className="size-3.5 text-destructive" />
            Each project keeps its own licence; the full texts ship with the application.
          </p>
        </AboutCard>
      </div>
    </div>
  );
}
