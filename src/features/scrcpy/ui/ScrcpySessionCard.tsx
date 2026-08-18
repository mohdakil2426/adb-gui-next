import { Rocket, Square } from 'lucide-react';
import { SelectSaveDirectory } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import {
  AUDIO_SOURCES,
  BITRATE_PRESETS,
  FPS_PRESETS,
  KEYBOARDS,
  MAX_SIZE_PRESETS,
  VIDEO_CODECS,
} from '@/features/scrcpy/model/defaults';
import { ScrcpyDeviceSelector } from '@/features/scrcpy/ui/ScrcpyDeviceSelector';
import { ScrcpyPresetField } from '@/features/scrcpy/ui/ScrcpyPresetField';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';

function FlagRow({
  checked,
  description,
  id,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  id: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2.5">
      <div className="min-w-0">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-caption text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} id={id} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function ScrcpySessionCard({
  activeSerials,
  canLaunch,
  isLaunching,
  isStopping,
  onClearAll,
  onLaunch,
  onOptionsChange,
  onSelectAll,
  onStop,
  onStopDevice,
  onToggleSerial,
  options,
  selectedSerials,
}: {
  activeSerials: Set<string>;
  canLaunch: boolean;
  isLaunching: boolean;
  isStopping: boolean;
  onClearAll: () => void;
  onLaunch: () => void;
  onOptionsChange: (partial: Partial<backend.ScrcpyLaunchOptions>) => void;
  onSelectAll: () => void;
  onStop: () => void;
  onStopDevice?: ((serial: string) => void) | undefined;
  onToggleSerial: (serial: string) => void;
  options: backend.ScrcpyLaunchOptions;
  selectedSerials: Set<string>;
}) {
  const pickRecordPath = async () => {
    const path = await SelectSaveDirectory('scrcpy-recording.mp4');
    if (path) {
      onOptionsChange({ recordPath: path });
    }
  };

  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader>
        <CardTitle className="text-title">Session</CardTitle>
        <CardDescription>
          Flags map 1:1 to the official scrcpy CLI. Configure display, audio, and controls.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ScrcpyDeviceSelector
          activeSerials={activeSerials}
          disabled={isLaunching || isStopping}
          onClearAll={onClearAll}
          onSelectAll={onSelectAll}
          onStopDevice={onStopDevice}
          onToggleSerial={onToggleSerial}
          selectedSerials={selectedSerials}
        />
        <div className="grid @xl:grid-cols-2 grid-cols-1 gap-3">
          <ScrcpyPresetField
            id="scrcpy-max-size"
            isNumeric
            label="Max size (px)"
            onChange={(maxSize) => onOptionsChange({ maxSize })}
            placeholder="e.g. 1920"
            presets={MAX_SIZE_PRESETS}
            value={options.maxSize}
          />
          <ScrcpyPresetField
            id="scrcpy-bitrate"
            label="Video bit rate"
            onChange={(videoBitRate) => onOptionsChange({ videoBitRate })}
            placeholder="e.g. 8M or 12M"
            presets={BITRATE_PRESETS}
            value={options.videoBitRate}
          />
          <ScrcpyPresetField
            id="scrcpy-fps"
            isNumeric
            label="Max FPS"
            onChange={(maxFps) => onOptionsChange({ maxFps })}
            placeholder="e.g. 60 or 120"
            presets={FPS_PRESETS}
            value={options.maxFps}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scrcpy-codec">Video codec</Label>
            <Select
              onValueChange={(value) => onOptionsChange({ videoCodec: value })}
              value={options.videoCodec ?? 'h264'}
            >
              <SelectTrigger className="w-full" id="scrcpy-codec">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIDEO_CODECS.map((codec) => (
                  <SelectItem key={codec} value={codec}>
                    {codec}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scrcpy-keyboard">Keyboard</Label>
            <Select
              onValueChange={(value) => onOptionsChange({ keyboard: value })}
              value={options.keyboard ?? 'uhid'}
            >
              <SelectTrigger className="w-full" id="scrcpy-keyboard">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KEYBOARDS.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scrcpy-audio">Audio source</Label>
            <Select
              onValueChange={(value) =>
                onOptionsChange({ audioSource: value === 'default' ? null : value })
              }
              value={options.audioSource ?? 'default'}
            >
              <SelectTrigger className="w-full" id="scrcpy-audio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                {AUDIO_SOURCES.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid @xl:grid-cols-2 grid-cols-1 gap-2">
          <FlagRow
            checked={options.stayAwake}
            description="Keep the device awake while mirroring."
            id="scrcpy-stay-awake"
            label="Stay awake"
            onCheckedChange={(checked) => onOptionsChange({ stayAwake: checked })}
          />
          <FlagRow
            checked={options.turnScreenOff}
            description="Turn the physical display off during the session."
            id="scrcpy-screen-off"
            label="Turn screen off"
            onCheckedChange={(checked) => onOptionsChange({ turnScreenOff: checked })}
          />
          <FlagRow
            checked={options.showTouches}
            description="Show physical touches on the device."
            id="scrcpy-touches"
            label="Show touches"
            onCheckedChange={(checked) => onOptionsChange({ showTouches: checked })}
          />
          <FlagRow
            checked={options.fullscreen}
            description="Start the scrcpy window fullscreen."
            id="scrcpy-fullscreen"
            label="Fullscreen"
            onCheckedChange={(checked) => onOptionsChange({ fullscreen: checked })}
          />
          <FlagRow
            checked={options.alwaysOnTop}
            description="Keep the scrcpy window above other windows."
            id="scrcpy-aot"
            label="Always on top"
            onCheckedChange={(checked) => onOptionsChange({ alwaysOnTop: checked })}
          />
          <FlagRow
            checked={options.borderless}
            description="Hide the native window border."
            id="scrcpy-borderless"
            label="Borderless"
            onCheckedChange={(checked) => onOptionsChange({ borderless: checked })}
          />
          <FlagRow
            checked={options.noAudio}
            description="Do not forward device audio."
            id="scrcpy-no-audio"
            label="No audio"
            onCheckedChange={(checked) => onOptionsChange({ noAudio: checked })}
          />
          <FlagRow
            checked={options.noControl}
            description="Mirror only — do not send input."
            id="scrcpy-no-control"
            label="No control"
            onCheckedChange={(checked) => onOptionsChange({ noControl: checked })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="scrcpy-record">Record to file (optional)</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-0 flex-1"
              id="scrcpy-record"
              onChange={(event) => onOptionsChange({ recordPath: event.target.value || null })}
              placeholder="No recording"
              value={options.recordPath ?? ''}
            />
            <Button onClick={() => void pickRecordPath()} type="button" variant="outline">
              Browse
            </Button>
          </div>
        </div>
        {selectedSerials.size > 0 &&
        Array.from(selectedSerials).every((s) => activeSerials.has(s) || activeSerials.has('*')) ? (
          <Button
            className="w-full hover:bg-destructive/10 hover:text-destructive"
            disabled={isStopping || selectedSerials.size === 0}
            onClick={onStop}
            type="button"
            variant="outline"
          >
            <Square aria-hidden="true" className="size-4" />
            {selectedSerials.size > 1
              ? `Stop Mirror (${selectedSerials.size} devices)`
              : 'Stop Mirror'}
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={isLaunching || isStopping || !canLaunch || selectedSerials.size === 0}
            onClick={onLaunch}
            type="button"
          >
            <Rocket aria-hidden="true" />
            {selectedSerials.size > 1
              ? `Launch Mirror (${selectedSerials.size} devices)`
              : selectedSerials.size === 1
                ? 'Launch Mirror'
                : 'Select a device to launch'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
