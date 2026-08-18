import { BatteryCharging, Camera, Code2, Folder, LayoutGrid, Play, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { RunShellCommand } from '@/desktop/backend';
import { Button } from '@/shared/ui/button';

interface QuickLaunchpadCardProps {
  selectedSerial: string | null;
}

export function QuickLaunchpadCard({ selectedSerial }: QuickLaunchpadCardProps) {
  const launchIntent = async (label: string, intentCmd: string) => {
    if (!selectedSerial) {
      toast.error('No device connected');
      return;
    }
    try {
      await RunShellCommand(intentCmd, selectedSerial);
      toast.success(`Launched ${label} on device`);
    } catch (e) {
      toast.error(`Failed to launch ${label}: ${String(e)}`);
    }
  };

  const actions = [
    {
      cmd: 'am start -a android.settings.SETTINGS',
      icon: Settings,
      label: 'Android Settings',
    },
    {
      cmd: 'am start -a android.settings.APPLICATION_DEVELOPMENT_SETTINGS',
      icon: Code2,
      label: 'Developer Options',
    },
    {
      cmd: 'am start -a android.intent.action.VIEW -d content://media/internal/images/media',
      icon: Folder,
      label: 'Files & Media',
    },
    {
      cmd: 'am start -a android.settings.MANAGE_ALL_APPLICATIONS_SETTINGS',
      icon: LayoutGrid,
      label: 'Manage All Apps',
    },
    {
      cmd: 'am start -a android.intent.action.POWER_USAGE_SUMMARY',
      icon: BatteryCharging,
      label: 'Battery & Power',
    },
    {
      cmd: 'am start -a android.media.action.IMAGE_CAPTURE',
      icon: Camera,
      label: 'Camera',
    },
  ];
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="size-4 text-primary" />
          <h3 className="font-medium text-foreground text-label">Device App Launchpad</h3>
        </div>
        <span className="text-caption text-muted-foreground">Direct ADB Intents</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <Button
              className="h-8 justify-start gap-2 border-border/80 bg-surface-raised/60 px-2.5 text-body text-foreground hover:bg-surface-raised"
              key={act.label}
              onClick={() => launchIntent(act.label, act.cmd)}
              size="sm"
              variant="outline"
            >
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{act.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
