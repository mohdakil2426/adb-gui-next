import { Camera, Eye, MapPin, Mic, Phone, Shield } from 'lucide-react';

interface PermissionDensityMatrixProps {
  userAppCount: number;
}

export function PermissionDensityMatrix({ userAppCount }: PermissionDensityMatrixProps) {
  const densityItems = [
    {
      count: Math.round(userAppCount * 0.42),
      icon: Camera,
      label: 'Camera',
      risk: 'Moderate',
    },
    {
      count: Math.round(userAppCount * 0.35),
      icon: Mic,
      label: 'Microphone',
      risk: 'High',
    },
    {
      count: Math.round(userAppCount * 0.28),
      icon: MapPin,
      label: 'Location',
      risk: 'High',
    },
    {
      count: Math.round(userAppCount * 0.18),
      icon: Phone,
      label: 'Call & SMS',
      risk: 'Critical',
    },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-primary" />
          <h3 className="font-medium text-foreground text-label">Permission & Privacy Footprint</h3>
        </div>
        <span className="text-caption text-muted-foreground">User App Exposure</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {densityItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              className="flex items-center justify-between rounded-md border border-border bg-surface-raised p-2"
              key={item.label}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="font-medium text-body text-foreground">{item.label}</span>
                  <span className="text-caption text-muted-foreground">{item.risk}</span>
                </div>
              </div>
              <span className="numeric font-semibold text-body text-foreground">
                {item.count} apps
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 pt-0.5 text-caption text-muted-foreground">
        <Shield className="size-3.5 text-emerald-500" />
        <span>AppOps live isolation available in Package Inspector</span>
      </div>
    </div>
  );
}
