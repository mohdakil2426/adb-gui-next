import { useEffect, useMemo, useRef } from 'react';
import { Clock3, Loader2, Search, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onSettings: () => void;
  onSelectHistory: (value: string) => void;
  isSearching: boolean;
  searchHistory: string[];
  placeholder?: string;
}

function getShortcutLabel(): string {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)) {
    return '⌘K';
  }

  return 'Ctrl K';
}

export function SearchBar({
  value,
  onChange,
  onClear,
  onSettings,
  onSelectHistory,
  isSearching,
  searchHistory,
  placeholder = 'Search apps, packages, or GitHub repositories…',
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shortcutLabel = useMemo(() => getShortcutLabel(), []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 pl-9 pr-28"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {isSearching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

          {searchHistory.length > 0 && (
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7 text-muted-foreground">
                      <Clock3 className="size-3.5" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Recent searches</TooltipContent>
              </Tooltip>
              <PopoverContent align="end" className="w-72 p-2">
                <div className="space-y-1">
                  <p className="px-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Recent searches
                  </p>
                  {searchHistory.map((entry) => (
                    <Button
                      key={entry}
                      variant="ghost"
                      className="h-8 w-full justify-start px-2 text-sm"
                      onClick={() => onSelectHistory(entry)}
                    >
                      <Clock3 className="mr-2 size-3.5 text-muted-foreground" />
                      <span className="truncate">{entry}</span>
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {value ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  onClick={onClear}
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Clear search</TooltipContent>
            </Tooltip>
          ) : (
            <kbd className="hidden rounded border bg-muted px-1.5 py-1 text-[10px] font-medium text-muted-foreground sm:inline-flex">
              {shortcutLabel}
            </kbd>
          )}
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-11 shrink-0 gap-2 px-3"
            onClick={onSettings}
          >
            <Settings2 className="size-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Marketplace settings</TooltipContent>
      </Tooltip>
    </div>
  );
}
