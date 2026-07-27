import { Clock3, Loader2, Search, Settings2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Kbd } from '@/shared/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { isMac } from '@/shared/utils/platform';

/**
 * `Ctrl/⌘+F`, not `Ctrl/⌘+K` — the shell now owns that chord for the global
 * command palette and had to swallow it in the capture phase to win.
 */
const SEARCH_SHORTCUT = isMac ? '⌘F' : 'Ctrl F';

interface SearchBarProps {
  isSearching: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onSelectHistory: (value: string) => void;
  onSettings: () => void;
  placeholder?: string;
  searchHistory: string[];
  value: string;
}

export function SearchBar({
  value,
  onChange,
  onClear,
  onSettings,
  onSelectHistory,
  isSearching,
  searchHistory,
  placeholder = 'Search apps, packages or GitHub repositories…',
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, []);

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Search marketplace apps, packages or GitHub repositories"
          className="h-9 pr-24 pl-8 text-body"
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          ref={inputRef}
          value={value}
        />
        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
          {isSearching ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin text-muted-foreground" />
          ) : null}

          {searchHistory.length > 0 && (
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      aria-label="Recent searches"
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Clock3 aria-hidden="true" className="size-3.5" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">Recent searches</TooltipContent>
              </Tooltip>
              <PopoverContent align="end" className="w-72 p-1">
                <p className="px-2 py-1 text-caption text-muted-foreground uppercase tracking-wide">
                  Recent searches
                </p>
                {searchHistory.map((entry) => (
                  <Button
                    className="w-full justify-start"
                    key={entry}
                    onClick={() => {
                      onSelectHistory(entry);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Clock3 aria-hidden="true" />
                    <span className="truncate">{entry}</span>
                  </Button>
                ))}
              </PopoverContent>
            </Popover>
          )}

          {value ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Clear search"
                  onClick={onClear}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Clear search</TooltipContent>
            </Tooltip>
          ) : (
            <Kbd className="@sm:inline-flex hidden">{SEARCH_SHORTCUT}</Kbd>
          )}
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Marketplace settings"
            className="h-9 shrink-0"
            onClick={onSettings}
            size="sm"
            type="button"
            variant="outline"
          >
            <Settings2 aria-hidden="true" />
            <span className="@sm:inline hidden">Settings</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Marketplace settings</TooltipContent>
      </Tooltip>
    </div>
  );
}
