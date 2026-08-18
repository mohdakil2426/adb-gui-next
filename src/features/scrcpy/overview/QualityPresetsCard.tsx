import { useQuery } from '@tanstack/react-query';
import { BatteryCharging, Briefcase, Check, Sparkles, Video, Zap } from 'lucide-react';
import { ScrcpyProfiles } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { QUALITY_PRESETS, type QualityPreset } from '@/features/scrcpy/model/defaults';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { cn } from '@/shared/utils/cn';

interface QualityPresetsCardProps {
  onApplyPreset: (partialOptions: Partial<backend.ScrcpyLaunchOptions>) => void;
  options: backend.ScrcpyLaunchOptions;
}

const PRESET_ICONS: Record<string, typeof Zap> = {
  battery: BatteryCharging,
  creator: Video,
  gaming: Zap,
  productivity: Briefcase,
};

export function QualityPresetsCard({ onApplyPreset, options }: QualityPresetsCardProps) {
  const { data: profiles } = useQuery({
    queryKey: ['scrcpy', 'profiles'],
    queryFn: ScrcpyProfiles,
    staleTime: 60_000,
  });

  const activePresets = profiles && profiles.length > 0 ? profiles : QUALITY_PRESETS;

  // Check if current options match a preset
  const matchesPreset = (preset: backend.ScrcpyQualityProfile | QualityPreset) => {
    const keys = Object.keys(preset.options) as (keyof backend.ScrcpyLaunchOptions)[];
    return keys.every((key) => options[key] === preset.options[key]);
  };

  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-4 text-foreground" />
            <CardTitle className="font-semibold text-body text-foreground">
              1-Click Streaming Cockpit Profiles
            </CardTitle>
          </div>
          <span className="text-caption text-muted-foreground">Select to optimize parameters</span>
        </div>
        <CardDescription className="text-caption text-muted-foreground">
          Instantly configure video bitrate, framerate, codecs, and device flags for your use case.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid @2xl:grid-cols-4 @lg:grid-cols-2 grid-cols-1 gap-3">
          {activePresets.map((preset) => {
            const Icon = PRESET_ICONS[preset.id] ?? Sparkles;
            const isCurrent = matchesPreset(preset);

            return (
              <div
                className={cn(
                  'group relative flex flex-col justify-between rounded-lg border p-3.5 transition-all duration-100 ease-standard',
                  isCurrent
                    ? 'border-foreground/40 bg-surface-raised ring-1 ring-foreground/20'
                    : 'border-border/80 bg-surface-raised/40 hover:border-border hover:bg-surface-raised',
                )}
                key={preset.id}
              >
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground">
                      <Icon aria-hidden="true" className="size-4" />
                    </div>
                    {isCurrent ? (
                      <Badge
                        className="gap-1 border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400"
                        variant="outline"
                      >
                        <Check aria-hidden="true" className="size-2.5" />
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        className="border-border/60 bg-surface/80 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        variant="outline"
                      >
                        {preset.badge}
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold text-body text-foreground">{preset.label}</h3>
                    <p className="mt-1 line-clamp-2 text-caption text-muted-foreground">
                      {preset.description}
                    </p>
                  </div>

                  {/* Spec Chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {preset.specs.map((spec) => (
                      <span
                        className="rounded border border-border/50 bg-surface/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                        key={spec}
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3">
                  <Button
                    className={cn(
                      'h-7 w-full font-medium text-caption',
                      isCurrent
                        ? 'border-border bg-surface text-foreground hover:bg-surface-raised'
                        : 'border-border/80 bg-surface-raised hover:bg-foreground hover:text-background',
                    )}
                    onClick={() => onApplyPreset(preset.options)}
                    size="sm"
                    type="button"
                    variant={isCurrent ? 'outline' : 'secondary'}
                  >
                    {isCurrent ? 'Current Profile' : 'Apply Profile'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
