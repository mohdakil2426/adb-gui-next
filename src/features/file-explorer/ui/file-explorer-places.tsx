import { Folder } from "lucide-react";

import {
  activePlaceId,
  FILE_EXPLORER_PLACES,
} from "@/features/file-explorer/model/file-explorer-places";
import {
  FE_DROP_OVER_CLASS,
  folderInternalDropProps,
} from "@/features/file-explorer/utils/file-explorer-drop";
import { cn } from "@/shared/utils/cn";

interface Props {
  currentPath: string;
  disabled: boolean;
  onMoveToFolder: (destDir: string, names: Iterable<string>) => Promise<void>;
  onNavigate: (path: string) => void;
}

export const FileExplorerPlaces = ({
  currentPath,
  disabled,
  onMoveToFolder,
  onNavigate,
}: Props) => {
  const activeId = activePlaceId(currentPath);

  return (
    <div className="flex flex-col gap-0.5 px-1.5 pt-1.5">
      <p className="text-caption text-muted-foreground px-2 py-1">Places</p>
      {FILE_EXPLORER_PLACES.map((place) => {
        const isActive = place.id === activeId;
        const dropProps = folderInternalDropProps(place.path, (destDir, names) => {
          void onMoveToFolder(destDir, names);
        });
        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "text-body ease-standard flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-90",
              "hover:bg-accent hover:text-accent-foreground",
              FE_DROP_OVER_CLASS,
              isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground"
            )}
            data-fe-drop-dir={place.path}
            disabled={disabled}
            key={place.id}
            onClick={() => {
              onNavigate(place.path);
            }}
            {...dropProps}
            type="button"
          >
            <Folder aria-hidden="true" className="text-primary size-4 shrink-0" />
            <span className="min-w-0 truncate">{place.label}</span>
          </button>
        );
      })}
    </div>
  );
};
