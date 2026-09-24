import { Keyboard, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { SCRCPY_SHORTCUTS } from "@/features/scrcpy/model/defaults";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Kbd, KbdGroup } from "@/shared/ui/kbd";
import { cn } from "@/shared/utils/cn";

const CATEGORIES = [
  { id: "all", label: "All Shortcuts" },
  { id: "navigation", label: "Navigation" },
  { id: "display", label: "Display & Window" },
  { id: "device", label: "Device Power & UI" },
  { id: "audio", label: "Volume & Audio" },
];

export const ShortcutsCheatSheet = () => {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredShortcuts = useMemo(
    () =>
      SCRCPY_SHORTCUTS.filter((item) => {
        const matchesCat = filterCategory === "all" || item.category === filterCategory;
        const matchesSearch =
          searchQuery.trim().length === 0 ||
          item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.keys.join("+").toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesSearch;
      }),
    [filterCategory, searchQuery]
  );

  return (
    <Card className="border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center @lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Keyboard aria-hidden="true" className="text-foreground size-4" />
              <CardTitle className="text-body text-foreground font-semibold">
                Scrcpy Keyboard Shortcuts Cheat-Sheet
              </CardTitle>
            </div>
            <CardDescription className="text-caption text-muted-foreground">
              Essential hardware navigation and mirroring control hotkeys (MOD is Alt on
              Windows/Linux).
            </CardDescription>
          </div>

          {/* Search Input */}
          <div className="relative w-full @lg:w-64">
            <Search
              aria-hidden="true"
              className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            />
            <Input
              aria-label="Search keyboard shortcuts"
              className="text-caption h-8 pl-8"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts..."
              type="text"
              value={searchQuery}
            />
          </div>
        </div>

        {/* Category Pill Filters */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {CATEGORIES.map((cat) => (
            <Button
              className={cn(
                "h-6 px-2.5 text-[11px]",
                filterCategory === cat.id
                  ? "border-border bg-surface-raised text-foreground font-medium"
                  : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
              )}
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              size="sm"
              type="button"
              variant={filterCategory === cat.id ? "outline" : "ghost"}
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {filteredShortcuts.length === 0 ? (
          <p className="text-caption text-muted-foreground py-6 text-center">
            No shortcuts matched your search query.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 @lg:grid-cols-2 @2xl:grid-cols-3">
            {filteredShortcuts.map((shortcut) => (
              <div
                className="border-border/70 bg-surface-raised/40 hover:bg-surface-raised/80 flex items-center justify-between gap-2.5 rounded-lg border p-2.5 transition-colors"
                key={shortcut.label}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-body text-foreground truncate font-medium">{shortcut.label}</p>
                  <p className="text-caption text-muted-foreground truncate">
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
};
