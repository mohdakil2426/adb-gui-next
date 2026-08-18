import { X } from 'lucide-react';
import { SelectSaveDirectory } from '@/desktop/backend';
import { RECORD_FORMAT_PRESETS } from '@/features/scrcpy/model/defaults';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';

interface ScrcpyRecordSectionProps {
  disabled?: boolean | undefined;
  onChange: (updates: { recordPath: string | null; recordFormat?: string | null }) => void;
  recordFormat: string | null;
  recordPath: string | null;
}

export function ScrcpyRecordSection({
  disabled = false,
  onChange,
  recordFormat,
  recordPath,
}: ScrcpyRecordSectionProps) {
  const isEnabled = Boolean(recordPath);

  const pickRecordPath = async () => {
    const defaultName = recordFormat ? `scrcpy-recording.${recordFormat}` : 'scrcpy-recording.mp4';
    const path = await SelectSaveDirectory(defaultName);
    if (path) {
      onChange({ recordPath: path });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-raised p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Label htmlFor="scrcpy-record-toggle">Record session to file</Label>
          <p className="text-caption text-muted-foreground">
            Capture mirrored video and audio directly to disk.
          </p>
        </div>
        <Switch
          checked={isEnabled}
          disabled={disabled}
          id="scrcpy-record-toggle"
          onCheckedChange={(checked) => {
            if (checked) {
              void pickRecordPath();
            } else {
              onChange({ recordPath: null, recordFormat: null });
            }
          }}
        />
      </div>

      {isEnabled ? (
        <div className="flex flex-col gap-2.5 pt-1">
          <div className="grid @lg:grid-cols-2 grid-cols-1 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scrcpy-record-format">Container format</Label>
              <Select
                disabled={disabled}
                onValueChange={(val) =>
                  onChange({ recordPath, recordFormat: val === 'auto' ? null : val })
                }
                value={recordFormat ?? 'auto'}
              >
                <SelectTrigger className="w-full" id="scrcpy-record-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORD_FORMAT_PRESETS.map((fmt) => (
                    <SelectItem key={fmt.value ?? 'auto'} value={fmt.value ?? 'auto'}>
                      {fmt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scrcpy-record">Destination file</Label>
              <div className="flex gap-2">
                <Input
                  className="min-w-0 flex-1"
                  disabled={disabled}
                  id="scrcpy-record"
                  onChange={(event) => onChange({ recordPath: event.target.value || null })}
                  placeholder="e.g. C:\Videos\session.mp4"
                  value={recordPath ?? ''}
                />
                <Button
                  disabled={disabled}
                  onClick={() => void pickRecordPath()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Browse
                </Button>
                <Button
                  aria-label="Clear recording path"
                  className="size-9 px-2"
                  disabled={disabled}
                  onClick={() => onChange({ recordPath: null, recordFormat: null })}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
