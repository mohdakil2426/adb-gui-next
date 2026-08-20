import { Clock3, Loader2, Search, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/shared/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/shared/ui/input-group';
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
  placeholder?: string;
  searchHistory: string[];
  value: string;
}

export function SearchBar({
  value,
  onChange,
  onClear,
  onSelectHistory,
  isSearching,
  searchHistory,
  placeholder = 'Search apps, packages, or GitHub repositories…',
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
    <div className="flex items-center gap-2">
      <InputGroup className="h-10 min-w-0 flex-1 bg-surface">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search marketplace apps, packages or GitHub repositories"
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          ref={inputRef}
          value={value}
        />
        <InputGroupAddon align="inline-end">
          {isSearching ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}

          {searchHistory.length > 0 ? (
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <InputGroupButton aria-label="Recent searches" size="icon-xs">
                      <Clock3 aria-hidden="true" />
                    </InputGroupButton>
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
          ) : null}

          {value ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <InputGroupButton aria-label="Clear search" onClick={onClear} size="icon-xs">
                  <X aria-hidden="true" />
                </InputGroupButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">Clear search</TooltipContent>
            </Tooltip>
          ) : (
            <Kbd className="@sm:inline-flex hidden">{SEARCH_SHORTCUT}</Kbd>
          )}
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
