import { FileVideo, FolderOpen, HelpCircle, Volume2, X } from 'lucide-react';
import { SelectSaveDirectory } from '@/desktop/backend';
import type { backend } from '@/desktop/models';
import { RECORD_FORMAT_PRESETS } from '@/features/scrcpy/model/defaults';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { cn } from '@/shared/utils/cn';

interface ScrcpyAudioTabProps {
  onOptionsChange: (partial: Partial<backend.ScrcpyLaunchOptions>) => void;
  options: backend.ScrcpyLaunchOptions;
}

export function ScrcpyAudioTab({ onOptionsChange, options }: ScrcpyAudioTabProps) {
  const isRecording = Boolean(options.recordPath);

  const handlePickRecordPath = async () => {
    const defaultExt = options.recordFormat ?? 'mp4';
    const defaultName = `scrcpy-recording.${defaultExt}`;
    const path = await SelectSaveDirectory(defaultName);
    if (path) {
      onOptionsChange({ recordPath: path });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Card: Audio Engine Configuration */}
      <Card className="border-border bg-surface shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Volume2 aria-hidden="true" className="size-4 text-foreground" />
              <CardTitle className="font-semibold text-body text-foreground">
                Audio Forwarding Engine
              </CardTitle>
            </div>
            <Badge
              className={cn(
                'text-caption',
                options.noAudio
                  ? 'border-border bg-surface-raised text-muted-foreground'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
              )}
              variant="outline"
            >
              {options.noAudio ? 'Muted / Disabled' : 'Audio Streaming Active'}
            </Badge>
          </div>
          <CardDescription className="text-caption text-muted-foreground">
            Stream Android device audio directly to host PC speakers in real-time (Android 11+
            required).
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="grid @lg:grid-cols-2 grid-cols-1 gap-4">
            {/* Audio Enable / Disable Toggle Row */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
              <div className="min-w-0">
                <Label
                  className="font-medium text-body text-foreground"
                  htmlFor="audio-forward-toggle"
                >
                  Forward Device Audio
                </Label>
                <p className="text-caption text-muted-foreground">
                  Stream audio to PC speakers with low-latency OPUS encoding
                </p>
              </div>
              <Switch
                checked={!options.noAudio}
                id="audio-forward-toggle"
                onCheckedChange={(enabled) => onOptionsChange({ noAudio: !enabled })}
              />
            </div>

            {/* Audio Capture Source */}
            <div className="flex flex-col gap-1.5 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
              <Label htmlFor="scrcpy-audio-source">Audio Capture Source</Label>
              <Select
                disabled={options.noAudio}
                onValueChange={(value) =>
                  onOptionsChange({ audioSource: value === 'default' ? null : value })
                }
                value={options.audioSource ?? 'default'}
              >
                <SelectTrigger className="h-9 w-full" id="scrcpy-audio-source">
                  <SelectValue placeholder="Default (Output / Playback)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Output / Playback (Device sounds)</SelectItem>
                  <SelectItem value="mic">Microphone (Device mic capture)</SelectItem>
                  <SelectItem value="playback">Playback (Internal app audio)</SelectItem>
                  <SelectItem value="voice-call">Voice Call (Call audio stream)</SelectItem>
                  <SelectItem value="mic-unprocessed">Unprocessed Mic (Raw input)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-surface-raised/30 p-3 text-caption text-muted-foreground">
            <HelpCircle aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span>
              Audio forwarding uses the official Scrcpy audio server subsystem. Audio is forwarded
              using high-quality OPUS codec on Android 11+. For Android 10 or earlier, audio is
              forwarded via USB audio or simulated mic where supported.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Card: Recording Studio */}
      <Card className="border-border bg-surface shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileVideo aria-hidden="true" className="size-4 text-foreground" />
              <CardTitle className="font-semibold text-body text-foreground">
                Mirror Recording Studio
              </CardTitle>
            </div>
            {isRecording ? (
              <Badge
                className="gap-1 border-rose-500/30 bg-rose-500/10 text-caption text-rose-400"
                variant="outline"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-rose-500" />
                Recording Arm Active
              </Badge>
            ) : (
              <Badge
                className="border-border bg-surface-raised text-caption text-muted-foreground"
                variant="outline"
              >
                Idle / Off
              </Badge>
            )}
          </div>
          <CardDescription className="text-caption text-muted-foreground">
            Automatically record and save mirroring sessions directly to MP4 or MKV files without
            loss of quality.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-surface-raised/40 p-3">
            <div className="min-w-0">
              <Label className="font-medium text-body text-foreground" htmlFor="record-auto-toggle">
                Auto-Record on Mirror Start
              </Label>
              <p className="text-caption text-muted-foreground">
                Capture the display and audio stream to disk when scrcpy launches
              </p>
            </div>
            <Switch
              checked={isRecording}
              id="record-auto-toggle"
              onCheckedChange={(checked) => {
                if (checked) {
                  void handlePickRecordPath();
                } else {
                  onOptionsChange({ recordPath: null });
                }
              }}
            />
          </div>

          {isRecording ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-surface-raised/30 p-3.5">
              <div className="grid @lg:grid-cols-2 grid-cols-1 gap-3">
                {/* Format Selector */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="scrcpy-record-format">Container Format</Label>
                  <Select
                    onValueChange={(val) =>
                      onOptionsChange({ recordFormat: val === 'auto' ? null : val })
                    }
                    value={options.recordFormat ?? 'auto'}
                  >
                    <SelectTrigger className="h-9 w-full" id="scrcpy-record-format">
                      <SelectValue placeholder="MP4 (Default)" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECORD_FORMAT_PRESETS.map((preset) => (
                        <SelectItem key={preset.label} value={preset.value ?? 'auto'}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Destination File Picker */}
                <div className="flex flex-col gap-1.5">
                  <Label>Output File Destination</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      className="h-9 gap-1.5 font-medium text-caption"
                      onClick={() => void handlePickRecordPath()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <FolderOpen aria-hidden="true" className="size-3.5" />
                      <span>Browse File</span>
                    </Button>
                    <Button
                      className="h-9 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => onOptionsChange({ recordPath: null })}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <X aria-hidden="true" className="size-3.5" />
                      <span>Clear</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Active Path Box */}
              {options.recordPath ? (
                <div className="flex flex-col gap-1 rounded border border-border/60 bg-surface p-2.5">
                  <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider">
                    Target Output File
                  </span>
                  <span className="truncate font-mono text-foreground text-mono-sm">
                    {options.recordPath}
                  </span>
                </div>
              ) : null}

              <p className="text-caption text-muted-foreground">
                Tip: If multiple devices are selected simultaneously, scrcpy will automatically
                append the device serial (e.g.{' '}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-mono-sm">
                  scrcpy-recording-SERIAL.mp4
                </code>
                ) to avoid file collisions.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
