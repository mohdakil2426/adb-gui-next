import { m, useReducedMotion } from 'framer-motion';
import { HardDrive, Package, ShieldCheck, User, Users } from 'lucide-react';
import type { PackageOverviewStats } from '@/features/app-manager/model/packageStats';
import { formatBytes } from '@/shared/utils/format';

interface AppMetricsHeroBannerProps {
  stats: PackageOverviewStats;
}

const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

export function AppMetricsHeroBanner({ stats }: AppMetricsHeroBannerProps) {
  const shouldReduceMotion = useReducedMotion();

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
      value: stats.totalStorageBytes > 0 ? formatBytes(stats.totalStorageBytes) : '—',
    },
  ];

  return (
    <div className="grid @lg:grid-cols-5 grid-cols-2 gap-2.5 rounded-xl border border-border bg-surface p-3">
      {specs.map((spec, index) => {
        const Icon = spec.icon;
        return (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col justify-between rounded-lg border border-border/60 bg-surface-raised/40 p-2.5 transition-colors hover:border-border hover:bg-surface-raised/80"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
            key={spec.label}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.32, delay: index * 0.05, ease: EASE_STANDARD }
            }
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-caption text-muted-foreground">{spec.label}</span>
              <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col pt-1.5">
              <span className="numeric font-bold text-foreground text-headline">{spec.value}</span>
              <span className="truncate text-caption text-muted-foreground">{spec.subtext}</span>
            </div>
          </m.div>
        );
      })}
    </div>
  );
}
