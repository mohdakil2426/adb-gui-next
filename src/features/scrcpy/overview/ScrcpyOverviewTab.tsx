import type { backend } from '@/desktop/models';
import { ActiveSessionController } from '@/features/scrcpy/overview/ActiveSessionController';
import { QualityPresetsCard } from '@/features/scrcpy/overview/QualityPresetsCard';
import { ShortcutsCheatSheet } from '@/features/scrcpy/overview/ShortcutsCheatSheet';
import { TargetDeviceSelector } from '@/features/scrcpy/overview/TargetDeviceSelector';

interface ScrcpyOverviewTabProps {
  activeSerials: Set<string>;
  activeSessions?: backend.ScrcpySessionInfo[] | undefined;
  disabled?: boolean | undefined;
  isStopping: boolean;
  onClearAll: () => void;
  onOptionsChange: (partial: Partial<backend.ScrcpyLaunchOptions>) => void;
  onSelectAll: () => void;
  onStopDevice: (serial: string) => void;
  onToggleSerial: (serial: string) => void;
  options: backend.ScrcpyLaunchOptions;
  selectedSerials: Set<string>;
}

export function ScrcpyOverviewTab({
  activeSerials,
  activeSessions,
  disabled = false,
  isStopping,
  onClearAll,
  onOptionsChange,
  onSelectAll,
  onStopDevice,
  onToggleSerial,
  options,
  selectedSerials,
}: ScrcpyOverviewTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* 1. Target Devices Selector */}
      <TargetDeviceSelector
        activeSerials={activeSerials}
        disabled={disabled}
        onClearAll={onClearAll}
        onSelectAll={onSelectAll}
        onStopDevice={onStopDevice}
        onToggleSerial={onToggleSerial}
        selectedSerials={selectedSerials}
      />

      {/* 2. Active Session Controller (if any mirroring active) */}
      <ActiveSessionController
        activeSerials={activeSerials}
        isStopping={isStopping}
        onStopDevice={onStopDevice}
        sessions={activeSessions}
      />

      {/* 3. 1-Click Quality Presets Cockpit */}
      <QualityPresetsCard onApplyPreset={onOptionsChange} options={options} />

      {/* 4. Scrcpy Shortcuts Cheat-Sheet */}
      <ShortcutsCheatSheet />
    </div>
  );
}
