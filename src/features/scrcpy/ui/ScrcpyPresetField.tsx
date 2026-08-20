import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';

export interface PresetOption<T> {
  label: string;
  value: T | null;
}

interface ScrcpyPresetFieldProps<T extends string | number> {
  id: string;
  isNumeric?: boolean;
  label: string;
  onChange: (value: T | null) => void;
  placeholder?: string;
  presets: PresetOption<T>[];
  value: T | null;
}

export function ScrcpyPresetField<T extends string | number>({
  id,
  isNumeric = false,
  label,
  onChange,
  placeholder,
  presets,
  value,
}: ScrcpyPresetFieldProps<T>) {
  const isMatchingPreset = presets.some((p) => p.value === value);
  const [isCustom, setIsCustom] = useState(!isMatchingPreset && value !== null);

  const selectValue = value === null ? 'none' : isMatchingPreset ? String(value) : 'custom';

  const handleSelectChange = (val: string) => {
    if (val === 'custom') {
      setIsCustom(true);
      return;
    }
    if (val === 'none') {
      setIsCustom(false);
      onChange(null);
      return;
    }
    setIsCustom(false);
    if (isNumeric) {
      onChange(Number(val) as T);
    } else {
      onChange(val as T);
    }
  };

  const handleInputChange = (raw: string) => {
    if (!raw.trim()) {
      onChange(null);
      return;
    }
    if (isNumeric) {
      const num = Number(raw);
      onChange(Number.isFinite(num) && num > 0 ? (num as T) : null);
    } else {
      onChange(raw as T);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {isCustom ? (
          <button
            className="text-caption text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              setIsCustom(false);
              const defaultPreset = presets[0]?.value ?? null;
              onChange(defaultPreset);
            }}
            type="button"
          >
            Presets
          </button>
        ) : null}
      </div>

      {isCustom ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            className="flex-1"
            id={id}
            inputMode={isNumeric ? 'numeric' : 'text'}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={placeholder}
            value={value ?? ''}
          />
          <Button onClick={() => setIsCustom(false)} size="sm" type="button" variant="outline">
            Presets
          </Button>
        </div>
      ) : (
        <Select onValueChange={handleSelectChange} value={selectValue}>
          <SelectTrigger className="w-full" id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {presets.map((preset) => (
                <SelectItem
                  key={preset.value === null ? 'none' : String(preset.value)}
                  value={preset.value === null ? 'none' : String(preset.value)}
                >
                  {preset.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom (manual value)…</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
