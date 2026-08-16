import { Package, Package2 } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { CheckboxItem } from '@/shared/components/CheckboxItem';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/utils/cn';

export function InstalledPackageRow({
  height,
  iconSrc,
  isSelected,
  onToggle,
  pkg,
  start,
}: {
  height: number;
  iconSrc: string | undefined;
  isSelected: boolean;
  onToggle: (name: string) => void;
  pkg: backend.InstalledPackage;
  start: number;
}) {
  return (
    <div
      aria-selected={isSelected}
      className={cn(
        'absolute left-0 flex w-full cursor-pointer select-none items-center gap-2 px-3 outline-none transition-colors duration-90 ease-standard hover:bg-accent',
        isSelected && 'bg-primary-muted',
      )}
      onClick={() => onToggle(pkg.name)}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          onToggle(pkg.name);
        }
      }}
      role="option"
      style={{ height: `${height}px`, transform: `translateY(${start}px)` }}
      tabIndex={0}
    >
      <CheckboxItem checked={isSelected} />
      {iconSrc ? (
        <img
          alt=""
          className="size-5 shrink-0 rounded-sm object-cover"
          height={20}
          src={iconSrc}
          width={20}
        />
      ) : pkg.packageType === 'system' ? (
        <Package2 aria-hidden="true" className="size-4 shrink-0 text-info" />
      ) : (
        <Package aria-hidden="true" className="size-4 shrink-0 text-primary" />
      )}
      <span className="min-w-0 flex-1 truncate font-medium text-body text-foreground">
        {pkg.label || pkg.name}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-mono-sm text-muted-foreground">
        {pkg.name}
      </span>
      <Badge className="shrink-0" variant={pkg.packageType === 'user' ? 'secondary' : 'neutral'}>
        {pkg.packageType}
      </Badge>
    </div>
  );
}
