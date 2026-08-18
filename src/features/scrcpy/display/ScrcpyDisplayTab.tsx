import { Gauge, Sliders, Tv } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { BandwidthGauge } from '@/features/scrcpy/display/BandwidthGauge';
import { BITRATE_PRESETS, FPS_PRESETS, MAX_SIZE_PRESETS } from '@/features/scrcpy/model/defaults';
import { ScrcpyPresetField } from '@/features/scrcpy/ui/ScrcpyPresetField';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { cn } from '@/shared/utils/cn';

interface ScrcpyDisplayTabProps {
  onOptionsChange: (partial: Partial<backend.ScrcpyLaunchOptions>) => void;
  options: backend.ScrcpyLaunchOptions;
}

export function ScrcpyDisplayTab({ onOptionsChange, options }: ScrcpyDisplayTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Top Grid: Video Resolution & Bitrate Tuning */}
      <div className="grid @2xl:grid-cols-3 grid-cols-1 gap-4">
        {/* Left 2 Cols: Video Stream Parameters */}
        <Card className="@2xl:col-span-2 border-border bg-surface shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sliders aria-hidden="true" className="size-4 text-foreground" />
              <CardTitle className="font-semibold text-body text-foreground">
                Video Stream Tuning
              </CardTitle>
            </div>
            <CardDescription className="text-caption text-muted-foreground">
              Configure maximum display dimensions, encoding bitrate, framerate, and hardware
              codecs.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="grid @lg:grid-cols-2 grid-cols-1 gap-3">
              <ScrcpyPresetField
                id="scrcpy-max-size"
                isNumeric
                label="Max Resolution / Size"
                onChange={(maxSize) => onOptionsChange({ maxSize })}
                placeholder="e.g. 1920 or 1080"
                presets={MAX_SIZE_PRESETS}
                value={options.maxSize}
              />

              <ScrcpyPresetField
                id="scrcpy-fps"
                isNumeric
                label="Max Framerate (FPS)"
                onChange={(maxFps) => onOptionsChange({ maxFps })}
                placeholder="e.g. 60 or 120"
                presets={FPS_PRESETS}
                value={options.maxFps}
              />
            </div>

            {/* Video Bitrate Stepper */}
            <div className="flex flex-col gap-2">
              <ScrcpyPresetField
                id="scrcpy-bitrate"
                label="Video Bitrate Target"
                onChange={(videoBitRate) => onOptionsChange({ videoBitRate })}
                placeholder="e.g. 8M or 16M"
                presets={BITRATE_PRESETS}
                value={options.videoBitRate}
              />

              {/* Quick Bitrate Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['2M', '4M', '8M', '12M', '16M', '24M', '32M', '64M'].map((br) => (
                  <Button
                    className={cn(
                      'h-6 px-2 font-mono text-caption',
                      options.videoBitRate === br
                        ? 'border-border bg-surface-raised font-bold text-foreground'
                        : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
                    )}
                    key={br}
                    onClick={() => onOptionsChange({ videoBitRate: br })}
                    size="sm"
                    type="button"
                    variant={options.videoBitRate === br ? 'outline' : 'ghost'}
                  >
                    {br}
                  </Button>
                ))}
              </div>
            </div>

            {/* Video Codec */}
            <div className="flex flex-col gap-1.5 pt-1">
              <Label htmlFor="scrcpy-codec">Video Codec</Label>
              <Select
                onValueChange={(value) => onOptionsChange({ videoCodec: value })}
                value={options.videoCodec ?? 'h264'}
              >
                <SelectTrigger className="h-9 w-full" id="scrcpy-codec">
                  <SelectValue placeholder="Select video codec" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="h264">H.264 / AVC (Default — High Compatibility)</SelectItem>
                  <SelectItem value="h265">H.265 / HEVC (Recommended for Wireless)</SelectItem>
                  <SelectItem value="av1">AV1 (Next-Gen High Efficiency)</SelectItem>
                  <SelectItem value="vp8">VP8 (WebRTC standard)</SelectItem>
                  <SelectItem value="vp9">VP9 (High-efficiency open codec)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Right 1 Col: Bandwidth Gauge Card */}
        <Card className="flex flex-col justify-between border-border bg-surface shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Gauge aria-hidden="true" className="size-4 text-foreground" />
              <CardTitle className="font-semibold text-body text-foreground">
                Bandwidth Telemetry
              </CardTitle>
            </div>
            <CardDescription className="text-caption text-muted-foreground">
              Estimated bandwidth consumption
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col items-center justify-center p-4">
            <BandwidthGauge bitrateStr={options.videoBitRate} />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid: Window & Display Flags */}
      <Card className="border-border bg-surface shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Tv aria-hidden="true" className="size-4 text-foreground" />
            <CardTitle className="font-semibold text-body text-foreground">
              Window & Display Automation Flags
            </CardTitle>
          </div>
          <CardDescription className="text-caption text-muted-foreground">
            Configure mirror window presentation, touch overlays, and power behavior.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid @2xl:grid-cols-3 @lg:grid-cols-2 grid-cols-1 gap-2.5">
            {/* Flag: Fullscreen */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
              <div className="min-w-0">
                <Label className="font-medium text-body text-foreground" htmlFor="flag-fullscreen">
                  Fullscreen
                </Label>
                <p className="text-caption text-muted-foreground">
                  Start mirror in fullscreen mode
                </p>
              </div>
              <Switch
                checked={options.fullscreen}
                id="flag-fullscreen"
                onCheckedChange={(fullscreen) => onOptionsChange({ fullscreen })}
              />
            </div>

            {/* Flag: Always On Top */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
              <div className="min-w-0">
                <Label
                  className="font-medium text-body text-foreground"
                  htmlFor="flag-always-on-top"
                >
                  Always on Top
                </Label>
                <p className="text-caption text-muted-foreground">Keep window above all apps</p>
              </div>
              <Switch
                checked={options.alwaysOnTop}
                id="flag-always-on-top"
                onCheckedChange={(alwaysOnTop) => onOptionsChange({ alwaysOnTop })}
              />
            </div>

            {/* Flag: Borderless */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
              <div className="min-w-0">
                <Label className="font-medium text-body text-foreground" htmlFor="flag-borderless">
                  Borderless Window
                </Label>
                <p className="text-caption text-muted-foreground">Disable OS window frame</p>
              </div>
              <Switch
                checked={options.borderless}
                id="flag-borderless"
                onCheckedChange={(borderless) => onOptionsChange({ borderless })}
              />
            </div>

            {/* Flag: Stay Awake */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
              <div className="min-w-0">
                <Label className="font-medium text-body text-foreground" htmlFor="flag-stay-awake">
                  Stay Awake
                </Label>
                <p className="text-caption text-muted-foreground">Prevent device from sleeping</p>
              </div>
              <Switch
                checked={options.stayAwake}
                id="flag-stay-awake"
                onCheckedChange={(stayAwake) => onOptionsChange({ stayAwake })}
              />
            </div>

            {/* Flag: Turn Screen Off */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
              <div className="min-w-0">
                <Label
                  className="font-medium text-body text-foreground"
                  htmlFor="flag-turn-screen-off"
                >
                  Turn Screen Off
                </Label>
                <p className="text-caption text-muted-foreground">Blank physical screen on start</p>
              </div>
              <Switch
                checked={options.turnScreenOff}
                id="flag-turn-screen-off"
                onCheckedChange={(turnScreenOff) => onOptionsChange({ turnScreenOff })}
              />
            </div>

            {/* Flag: Show Touches */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
              <div className="min-w-0">
                <Label
                  className="font-medium text-body text-foreground"
                  htmlFor="flag-show-touches"
                >
                  Show Touch Circles
                </Label>
                <p className="text-caption text-muted-foreground">Display visual touch points</p>
              </div>
              <Switch
                checked={options.showTouches}
                id="flag-show-touches"
                onCheckedChange={(showTouches) => onOptionsChange({ showTouches })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
