import { Camera, Eye, HardDrive, MapPin, Mic, Phone, Shield } from 'lucide-react';
import type { backend } from '@/desktop/models';

interface PermissionDensityMatrixProps {
  items?: backend.PermissionDensityItem[];
  userAppCount?: number;
}

function getPermissionIcon(permission: string, label: string) {
  const text = `${permission} ${label}`.toLowerCase();
  if (text.includes('camera')) {
    return Camera;
  }
  if (text.includes('audio') || text.includes('record') || text.includes('mic')) {
    return Mic;
  }
  if (text.includes('location') || text.includes('gps')) {
    return MapPin;
  }
  if (
    text.includes('phone') ||
    text.includes('call') ||
    text.includes('sms') ||
    text.includes('contact')
  ) {
    return Phone;
  }
  if (text.includes('storage') || text.includes('media') || text.includes('files')) {
    return HardDrive;
  }
  return Shield;
}

function getRiskLabel(risk: string) {
  switch (risk.toLowerCase()) {
    case 'critical':
      return { label: 'Critical', color: 'text-rose-500' };
    case 'elevated':
    case 'high':
      return { label: 'High', color: 'text-amber-500' };
    default:
      return { label: 'Standard', color: 'text-muted-foreground' };
  }
}

export function PermissionDensityMatrix({ items = [] }: PermissionDensityMatrixProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="size-4 text-primary" />
          <h3 className="font-medium text-foreground text-label">Permission & Privacy Footprint</h3>
        </div>
        <span className="text-caption text-muted-foreground">User App Exposure</span>
      </div>

      {items.length === 0 ? (
        <div className="flex h-28 items-center justify-center rounded-md border border-border border-dashed text-caption text-muted-foreground">
          No permission telemetry available
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => {
            const Icon = getPermissionIcon(item.permission, item.label);
            const riskInfo = getRiskLabel(item.riskLevel);
            return (
              <div
                className="flex items-center justify-between rounded-md border border-border bg-surface-raised p-2"
                key={item.permission || item.label}
              >
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-medium text-body text-foreground">
                      {item.label || item.permission}
                    </span>
                    <span className={`text-caption ${riskInfo.color}`}>{riskInfo.label}</span>
                  </div>
                </div>
                <span className="numeric font-semibold text-body text-foreground">
                  {item.count} apps
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
