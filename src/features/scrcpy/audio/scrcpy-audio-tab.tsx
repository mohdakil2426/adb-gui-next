import { FileVideo, FolderOpen, HelpCircle, Volume2, X } from "lucide-react";

import { SelectSaveDirectory } from "@/desktop/backend";
import type { backend } from "@/desktop/models";
import { RECORD_FORMAT_PRESETS } from "@/features/scrcpy/model/defaults";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/utils/cn";

interface ScrcpyAudioTabProps {
  onOptionsChange: (partial: Partial<backend.ScrcpyLaunchOptions>) => void;
  options: backend.ScrcpyLaunchOptions;
}

export const ScrcpyAudioTab = ({ onOptionsChange, options }: ScrcpyAudioTabProps) => {
  const isRecording = Boolean(options.recordPath);

  const handlePickRecordPath = async () => {
    const defaultExt = options.recordFormat ?? "mp4";
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
              <Volume2 aria-hidden="true" className="text-foreground size-4" />
              <CardTitle className="text-body text-foreground font-semibold">
                Audio Forwarding Engine
              </CardTitle>
            </div>
            <Badge
              className={cn(
                "text-caption",
                options.noAudio
                  ? "border-border bg-surface-raised text-muted-foreground"
                  : "border-success/30 bg-success/10 text-success"
              )}
              variant="outline"
            >
              {options.noAudio ? "Muted / Disabled" : "Audio Streaming Active"}
            </Badge>
          </div>
          <CardDescription className="text-caption text-muted-foreground">
            Stream Android device audio directly to host PC speakers in real-time (Android 11+
            required).
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
            {/* Audio Enable / Disable Toggle Row */}
            <div className="border-border/80 bg-surface-raised/40 flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <Label
                  className="text-body text-foreground font-medium"
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
            <div className="border-border/80 bg-surface-raised/40 flex flex-col gap-1.5 rounded-lg border p-3">
              <Label htmlFor="scrcpy-audio-source">Audio Capture Source</Label>
              <Select
                disabled={options.noAudio}
                onValueChange={(value) =>
                  onOptionsChange({
                    audioSource: value === "default" ? null : value,
                  })
                }
                value={options.audioSource ?? "default"}
              >
                <SelectTrigger className="h-9 w-full" id="scrcpy-audio-source">
                  <SelectValue placeholder="Default (Output / Playback)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="default">Output / Playback (Device sounds)</SelectItem>
                    <SelectItem value="mic">Microphone (Device mic capture)</SelectItem>
                    <SelectItem value="playback">Playback (Internal app audio)</SelectItem>
                    <SelectItem value="voice-call">Voice Call (Call audio stream)</SelectItem>
                    <SelectItem value="mic-unprocessed">Unprocessed Mic (Raw input)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-border/60 bg-surface-raised/30 text-caption text-muted-foreground flex items-start gap-2.5 rounded-lg border p-3">
            <HelpCircle aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
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
              <FileVideo aria-hidden="true" className="text-foreground size-4" />
              <CardTitle className="text-body text-foreground font-semibold">
                Mirror Recording Studio
              </CardTitle>
            </div>
            {isRecording ? (
              <Badge
                className="text-caption border-destructive/30 bg-destructive/10 text-destructive gap-1"
                variant="outline"
              >
                <span className="bg-destructive size-1.5 animate-pulse rounded-full" />
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
          <div className="border-border/80 bg-surface-raised/40 flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <Label className="text-body text-foreground font-medium" htmlFor="record-auto-toggle">
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
            <div className="border-border/80 bg-surface-raised/30 flex flex-col gap-3 rounded-lg border p-3.5">
              <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
                {/* Format Selector */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="scrcpy-record-format">Container Format</Label>
                  <Select
                    onValueChange={(val) =>
                      onOptionsChange({
                        recordFormat: val === "auto" ? null : val,
                      })
                    }
                    value={options.recordFormat ?? "auto"}
                  >
                    <SelectTrigger className="h-9 w-full" id="scrcpy-record-format">
                      <SelectValue placeholder="MP4 (Default)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {RECORD_FORMAT_PRESETS.map((preset) => (
                          <SelectItem key={preset.label} value={preset.value ?? "auto"}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                {/* Destination File Picker */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-body font-medium">Output File Destination</span>
                  <div className="flex items-center gap-2">
                    <Button
                      className="text-caption h-9 gap-1.5 font-medium"
                      onClick={() => {
                        void handlePickRecordPath();
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <FolderOpen
                        aria-hidden="true"
                        className="size-3.5"
                        data-icon="inline-start"
                      />
                      <span>Browse File</span>
                    </Button>
                    <Button
                      className="text-muted-foreground hover:text-foreground h-9 px-2"
                      onClick={() => onOptionsChange({ recordPath: null })}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <X aria-hidden="true" className="size-3.5" data-icon="inline-start" />
                      <span>Clear</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Active Path Box */}
              {options.recordPath ? (
                <div className="border-border/60 bg-surface flex flex-col gap-1 rounded border p-2.5">
                  <span className="text-muted-foreground text-caption font-medium tracking-wider uppercase">
                    Target Output File
                  </span>
                  <span className="text-foreground text-mono-sm truncate font-mono">
                    {options.recordPath}
                  </span>
                </div>
              ) : null}

              <p className="text-caption text-muted-foreground">
                Tip: If multiple devices are selected simultaneously, scrcpy will automatically
                append the device serial (e.g.{" "}
                <code className="bg-surface text-mono-sm rounded px-1 py-0.5 font-mono">
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
};
