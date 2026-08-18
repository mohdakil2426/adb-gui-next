import { Keyboard, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SCRCPY_SHORTCUTS } from '@/features/scrcpy/model/defaults';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Kbd, KbdGroup } from '@/shared/ui/kbd';
import { cn } from '@/shared/utils/cn';

export function ShortcutsCheatSheet() {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredShortcuts = useMemo(
    () =>
      SCRCPY_SHORTCUTS.filter((item) => {
        const matchesCat = filterCategory === 'all' || item.category === filterCategory;
        const matchesSearch =
          searchQuery.trim().length === 0 ||
          item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.keys.join('+').toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
      }),
    [filterCategory, searchQuery],
  );

  const categories = [
    { id: 'all', label: 'All Shortcuts' },
    { id: 'navigation', label: 'Navigation' },
    { id: 'display', label: 'Display & Window' },
    { id: 'device', label: 'Device Power & UI' },
    { id: 'audio', label: 'Volume & Audio' },
  ];

  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex @lg:flex-row flex-col @lg:items-center @lg:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Keyboard aria-hidden="true" className="size-4 text-foreground" />
              <CardTitle className="font-semibold text-body text-foreground">
                Scrcpy Keyboard Shortcuts Cheat-Sheet
              </CardTitle>
            </div>
            <CardDescription className="text-caption text-muted-foreground">
              Essential hardware navigation and mirroring control hotkeys (MOD is Alt on
              Windows/Linux).
            </CardDescription>
          </div>

          {/* Search Input */}
          <div className="relative @lg:w-64 w-full">
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="h-8 pl-8 text-caption"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts..."
              type="text"
              value={searchQuery}
            />
          </div>
        </div>

        {/* Category Pill Filters */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {categories.map((cat) => (
            <Button
              className={cn(
                'h-6 px-2.5 text-[11px]',
                filterCategory === cat.id
                  ? 'border-border bg-surface-raised font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
              )}
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              size="sm"
              type="button"
              variant={filterCategory === cat.id ? 'outline' : 'ghost'}
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {filteredShortcuts.length === 0 ? (
          <p className="py-6 text-center text-caption text-muted-foreground">
            No shortcuts matched your search query.
          </p>
        ) : (
          <div className="grid @2xl:grid-cols-3 @lg:grid-cols-2 grid-cols-1 gap-2">
            {filteredShortcuts.map((shortcut) => (
              <div
                className="flex items-center justify-between gap-2.5 rounded-lg border border-border/70 bg-surface-raised/40 p-2.5 transition-colors hover:bg-surface-raised/80"
                key={shortcut.label}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-body text-foreground">{shortcut.label}</p>
                  <p className="truncate text-caption text-muted-foreground">
                    {shortcut.description}
                  </p>
                </div>

                <KbdGroup className="shrink-0">
                  {shortcut.keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </KbdGroup>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
