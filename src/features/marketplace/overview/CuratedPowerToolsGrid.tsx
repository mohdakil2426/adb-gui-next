import { Flame, Package, Star } from 'lucide-react';
import type { backend } from '@/desktop/models';
import type { InstallTarget } from '@/features/marketplace/model/installTarget';
import { AppInstallButton } from '@/features/marketplace/ui/AppInstallButton';
import { ProviderBadge } from '@/features/marketplace/ui/ProviderBadge';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/card';

type MarketplaceApp = backend.MarketplaceApp;

export interface CuratedAppDef {
  categories: string[];
  description: string;
  downloadUrl?: string;
  iconUrl?: string;
  name: string;
  packageName: string;
  rating?: number;
  repoStars?: number;
  source: 'GitHub' | 'F-Droid' | 'Aptoide';
  summary: string;
  version: string;
}

export const CURATED_POWER_TOOLS: CuratedAppDef[] = [
  {
    name: 'Termux',
    packageName: 'com.termux',
    summary: 'Advanced Android terminal emulator and comprehensive Linux environment.',
    description:
      'Termux is an Android terminal emulator and Linux environment app that works directly with no rooting or setup required.',
    source: 'GitHub',
    version: 'v0.118.1',
    repoStars: 32_400,
    rating: 4.8,
    categories: ['Developer Tools', 'System'],
    downloadUrl:
      'https://github.com/termux/termux-app/releases/latest/download/termux-app_v0.118.1+github-debug_arm64-v8a.apk',
    iconUrl:
      'https://raw.githubusercontent.com/termux/termux-app/master/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
  },
  {
    name: 'Shizuku',
    packageName: 'moe.shizuku.privileged.api',
    summary: 'Elevate non-root apps to execute system APIs directly with ADB privileges.',
    description:
      'Shizuku allows ordinary apps to use system APIs directly with ADB or root permissions through a local binder service.',
    source: 'GitHub',
    version: 'v13.5.4',
    repoStars: 14_800,
    rating: 4.9,
    categories: ['System', 'Developer Tools'],
    downloadUrl:
      'https://github.com/RikkaApps/Shizuku/releases/latest/download/shizuku-v13.5.4.r1046.06c4b22-release.apk',
    iconUrl:
      'https://raw.githubusercontent.com/RikkaApps/Shizuku/master/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
  },
  {
    name: 'Magisk',
    packageName: 'com.topjohnwu.magisk',
    summary: 'The suite for Android systemless rooting, module hooking & boot patching.',
    description:
      'Magisk is a suite of open source software for customizing Android, supporting devices higher than Android 5.0.',
    source: 'GitHub',
    version: 'v27.0',
    repoStars: 48_900,
    rating: 4.9,
    categories: ['System & Root', 'Utility'],
    downloadUrl: 'https://github.com/topjohnwu/Magisk/releases/latest/download/Magisk-v27.0.apk',
    iconUrl:
      'https://raw.githubusercontent.com/topjohnwu/Magisk/master/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
  },
  {
    name: 'ViPER4Android FX',
    packageName: 'com.pittvandewitt.viperfx',
    summary: 'Professional system-level DSP audio processor and acoustic equalizer.',
    description:
      'An advanced audio management and enhancement tool for rooted Android devices with high-precision convolver.',
    source: 'GitHub',
    version: 'v2.7.2.1',
    repoStars: 6800,
    rating: 4.7,
    categories: ['Media', 'System'],
    downloadUrl:
      'https://github.com/v4a-re/ViPER4Android-FX/releases/latest/download/ViPER4AndroidFX.apk',
  },
  {
    name: 'ReVanced Manager',
    packageName: 'app.revanced.manager.flutter',
    summary: 'Modular application patcher for YouTube, Reddit, Twitter, and Spotify.',
    description:
      'ReVanced Manager enables building, patching, and maintaining custom modded Android applications seamlessly.',
    source: 'GitHub',
    version: 'v1.21.0',
    repoStars: 19_200,
    rating: 4.8,
    categories: ['Utility', 'Customization'],
    downloadUrl:
      'https://github.com/ReVanced/revanced-manager/releases/latest/download/revanced-manager-v1.21.0.apk',
    iconUrl:
      'https://raw.githubusercontent.com/ReVanced/revanced-manager/main/assets/images/logo.png',
  },
  {
    name: 'Lawnchair 14',
    packageName: 'ch.deletescape.lawnchair.plah',
    summary: 'Powerful, highly customizable open-source launcher based on Pixel Launcher.',
    description:
      'Lawnchair is a free, open-source home app for Android based on Launcher3 with rich customization and QuickSwitch support.',
    source: 'GitHub',
    version: 'v14-beta2',
    repoStars: 11_500,
    rating: 4.6,
    categories: ['Customization', 'System'],
    downloadUrl:
      'https://github.com/LawnchairLauncher/lawnchair/releases/latest/download/Lawnchair.apk',
  },
  {
    name: 'Proton Pass',
    packageName: 'proton.android.pass',
    summary: 'End-to-end encrypted open-source password and identity manager.',
    description:
      'Proton Pass is an open-source, encrypted password manager created by the team behind Proton Mail and Proton VPN.',
    source: 'F-Droid',
    version: 'v1.22.0',
    repoStars: 4200,
    rating: 4.7,
    categories: ['Privacy & Security'],
    downloadUrl:
      'https://github.com/protonpass/android-pass/releases/latest/download/ProtonPass.apk',
  },
  {
    name: 'PipePipe',
    packageName: 'piped.pipepipe',
    summary: 'Lightweight, ad-free streaming client for YouTube, BiliBili and NicoNico.',
    description:
      'A privacy-friendly streaming frontend without proprietary Google Play Services dependencies.',
    source: 'GitHub',
    version: 'v3.7.0',
    repoStars: 5100,
    rating: 4.8,
    categories: ['Media & Streaming', 'Privacy'],
    downloadUrl:
      'https://github.com/InfinityLoop1309/PipePipe/releases/latest/download/PipePipe.apk',
  },
];

export function toMarketplaceApp(curated: CuratedAppDef): MarketplaceApp {
  return {
    name: curated.name,
    packageName: curated.packageName,
    version: curated.version,
    summary: curated.summary,
    categories: curated.categories,
    downloadsCount: curated.repoStars ?? null,
    rating: curated.rating ?? null,
    source: curated.source,
    availableSources: [curated.source],
    iconUrl: curated.iconUrl ?? null,
    downloadUrl: curated.downloadUrl ?? null,
    installable: Boolean(curated.downloadUrl),
    language: 'Kotlin',
    malwareStatus: null,
    repoUrl: null,
    size: null,
    updatedAt: null,
  };
}

interface CuratedPowerToolsGridProps {
  onSelectApp: (app: MarketplaceApp) => void;
  target: InstallTarget;
}

export function CuratedPowerToolsGrid({ onSelectApp, target }: CuratedPowerToolsGridProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="size-4 text-warning" />
          <h3 className="font-semibold text-body text-foreground">
            Curated Open-Source Android Power Tools
          </h3>
        </div>
        <Badge className="font-mono text-caption text-muted-foreground" variant="outline">
          {CURATED_POWER_TOOLS.length} Essential Tools
        </Badge>
      </div>

      <div className="grid @2xl:grid-cols-4 @lg:grid-cols-2 @xs:grid-cols-1 gap-3">
        {CURATED_POWER_TOOLS.map((tool) => {
          const app = toMarketplaceApp(tool);
          return (
            <Card
              className="flex flex-col justify-between gap-0 rounded-lg border-border bg-surface py-0 shadow-none transition-all duration-150 hover:border-border-strong hover:bg-surface-raised/40"
              key={tool.packageName}
            >
              <button
                aria-label={`Inspect ${tool.name}`}
                className="flex w-full flex-1 cursor-pointer flex-col gap-2.5 p-3.5 text-left"
                onClick={() => onSelectApp(app)}
                type="button"
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2.5 p-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-raised">
                      {tool.iconUrl ? (
                        <img
                          alt=""
                          className="size-10 object-cover"
                          height={40}
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                          src={tool.iconUrl}
                          width={40}
                        />
                      ) : (
                        <Package className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-semibold text-body text-foreground">
                          {tool.name}
                        </span>
                      </div>
                      <span className="truncate font-mono text-caption text-muted-foreground">
                        {tool.packageName}
                      </span>
                    </div>
                  </div>
                  <ProviderBadge compact source={tool.source} />
                </CardHeader>

                <CardContent className="flex flex-col gap-2 p-0">
                  <p className="line-clamp-2 text-caption text-muted-foreground leading-relaxed">
                    {tool.summary}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {tool.categories.slice(0, 2).map((cat) => (
                      <span
                        className="rounded border border-border/50 bg-surface-raised px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground"
                        key={cat}
                      >
                        {cat}
                      </span>
                    ))}
                    {tool.repoStars ? (
                      <span className="ml-auto inline-flex items-center gap-0.5 font-mono text-caption text-muted-foreground">
                        <Star className="size-3 fill-current text-warning" />
                        {(tool.repoStars / 1000).toFixed(1)}k
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </button>

              <CardFooter className="mt-auto flex items-center justify-between border-border/40 border-t bg-surface-raised/20 p-3 pt-0">
                <span className="truncate font-mono text-caption text-muted-foreground">
                  {tool.version}
                </span>
                <AppInstallButton app={app} onSelect={onSelectApp} target={target} />
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
