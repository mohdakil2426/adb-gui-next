import { useRef, useEffect } from 'react';
import { Search, Loader2, X, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onSettings: () => void;
  isSearching: boolean;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  onClear,
  onSettings,
  isSearching,
  placeholder = 'Search apps across F-Droid, IzzyOnDroid, GitHub, Aptoide...',
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-32 h-10"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {value ? (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClear}>
            <X className="h-3 w-3" />
          </Button>
        ) : (
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          onClick={onSettings}
          title="Marketplace Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
