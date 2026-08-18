import { HardDrive, Package, ShieldCheck, User, Users } from 'lucide-react';
import type { PackageOverviewStats } from '@/features/app-manager/model/packageStats';

interface AppMetricsHeroBannerProps {
  stats: PackageOverviewStats;
}

export function AppMetricsHeroBanner({ stats }: AppMetricsHeroBannerProps) {
  const specs = [
    {
      icon: Package,
      label: 'Total Packages',
      subtext: 'Installed on device',
      value: String(stats.totalCount),
    },
    {
      icon: User,
      label: 'User Applications',
      subtext: 'Third-party & Sideloaded',
      value: String(stats.userCount),
    },
    {
      icon: Users,
      label: 'System Framework',
      subtext: 'OS & Vendor Core',
      value: String(stats.systemCount),
    },
    {
      icon: ShieldCheck,
      label: 'Safe to Debloat',
      subtext: 'UAD community verified',
      value: String(stats.safetyTiers.recommended),
    },
    {
      icon: HardDrive,
      label: 'Storage Footprint',
      subtext: 'Combined App + Data',
      value: '~42.8 GB',
    },
  ];

  return (
    <div className="grid @lg:grid-cols-5 grid-cols-2 gap-2.5 rounded-lg border border-border bg-surface p-3">
      {specs.map((spec) => {
        const Icon = spec.icon;
        return (
          <div
            className="flex flex-col justify-between rounded-md border border-border/60 bg-surface-raised/50 p-2.5"
            key={spec.label}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-caption text-muted-foreground">{spec.label}</span>
              <Icon className="size-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col pt-1.5">
              <span className="numeric font-bold text-foreground text-headline">{spec.value}</span>
              <span className="truncate text-caption text-muted-foreground">{spec.subtext}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
