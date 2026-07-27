import { Cpu, Heart, Package, Scale } from 'lucide-react';
import type { ReactNode } from 'react';
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
    <div className="flex items-baseline justify-between gap-4 py-1">
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

      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-4">
        <img
          alt=""
          className="size-14 shrink-0 object-contain"
          height={56}
          src="/logo.png"
          width={56}
        />
        <div className="min-w-0 flex-1">
          <p className="text-display text-foreground">{APP_NAME}</p>
          <p className="mt-0.5 max-w-prose text-body text-muted-foreground">
            A desktop front end for adb and fastboot: inspect a device, move files, manage apps,
            flash partitions and unpack firmware — without memorising command lines.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge className="numeric" variant="info">
            v{APP_VERSION}
          </Badge>
          {target.isDebug ? <Badge variant="warning">Development build</Badge> : null}
        </div>
      </section>

      <div className="grid @3xl:grid-cols-2 grid-cols-1 items-start gap-4">
        <AboutCard icon={Cpu} title="Build">
          <dl className="flex flex-col divide-y divide-border">
            <DetailRow label="Version" value={APP_VERSION} />
            <DetailRow label="Platform" value={`${target.platform} · ${target.arch}`} />
            {target.triple ? <DetailRow label="Target triple" value={target.triple} /> : null}
            <DetailRow label="Bundled adb" value={toolValue(tools?.adb)} />
            <DetailRow label="Bundled fastboot" value={toolValue(tools?.fastboot)} />
          </dl>
          <p className="mt-2 text-caption text-muted-foreground">
            adb and fastboot ship inside the app, so nothing has to be installed separately or put
            on PATH.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ExternalLinkButton url={RELEASES_URL}>Release notes</ExternalLinkButton>
            <ExternalLinkButton url={ISSUES_URL} variant="ghost">
              Report a problem
            </ExternalLinkButton>
          </div>
        </AboutCard>

        <AboutCard icon={Scale} title="Licence">
          <dl className="flex flex-col divide-y divide-border">
            <DetailRow label="Licence" value={APP_LICENSE} />
            <DetailRow label="Copyright" value={APP_COPYRIGHT} />
          </dl>
          <p className="mt-2 text-body text-muted-foreground">
            Released under the MIT licence: use it, modify it and redistribute it, including
            commercially, as long as the copyright notice travels with it. It comes with no
            warranty.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ExternalLinkButton url={REPOSITORY_URL}>Source code</ExternalLinkButton>
            <ExternalLinkButton url={LICENSE_URL} variant="ghost">
              Full licence text
            </ExternalLinkButton>
          </div>
        </AboutCard>

        <AboutCard className="@3xl:col-span-2" icon={Package} title="Built with">
          <ul className="grid @lg:grid-cols-2 grid-cols-1 gap-x-6">
            {CREDITS.map((credit) => (
              <li
                className="flex items-baseline justify-between gap-3 border-border border-b py-1.5 last:border-b-0"
                key={credit.name}
              >
                <span className="min-w-0">
                  <span className="block truncate text-body text-foreground">{credit.name}</span>
                  <span className="block truncate text-caption text-muted-foreground">
                    {credit.role}
                  </span>
                </span>
                <span className="shrink-0 text-caption text-muted-foreground">
                  {credit.license}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-caption text-muted-foreground">
            <Heart aria-hidden="true" className="size-3.5 text-destructive" />
            Each project keeps its own licence; the full texts ship with the application.
          </p>
        </AboutCard>
      </div>
    </div>
  );
}
