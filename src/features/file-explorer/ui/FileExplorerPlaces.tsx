import { Folder } from 'lucide-react';
import {
  activePlaceId,
  FILE_EXPLORER_PLACES,
} from '@/features/file-explorer/model/fileExplorerPlaces';
import { cn } from '@/shared/utils/cn';

interface Props {
  currentPath: string;
  disabled: boolean;
  onNavigate: (path: string) => void;
}

export function FileExplorerPlaces({ currentPath, disabled, onNavigate }: Props) {
  const activeId = activePlaceId(currentPath);

  return (
    <div className="flex flex-col gap-0.5 px-1.5 pt-1.5">
      <p className="px-2 py-1 text-caption text-muted-foreground">Places</p>
      {FILE_EXPLORER_PLACES.map((place) => {
        const isActive = place.id === activeId;
        return (
          <button
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-body transition-colors duration-90 ease-standard',
              'hover:bg-accent hover:text-accent-foreground',
              isActive ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground',
            )}
            disabled={disabled}
            key={place.id}
            onClick={() => {
              onNavigate(place.path);
            }}
            type="button"
          >
            <Folder aria-hidden="true" className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 truncate">{place.label}</span>
          </button>
        );
      })}
    </div>
  );
}
