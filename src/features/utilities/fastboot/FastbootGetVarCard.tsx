import { Database, FileJson, Loader2, RefreshCw, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RunFastbootHostCommand, SaveLog } from '@/desktop/backend';
import { CopyButton } from '@/shared/components/CopyButton';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { handleError, handleSuccess } from '@/shared/utils/errorHandler';

interface VariableRow {
  category: 'hardware' | 'security' | 'slots' | 'partition' | 'misc';
  key: string;
  value: string;
}

interface FastbootGetVarCardProps {
  deviceMode: 'adb' | 'fastboot' | 'unknown';
  deviceSerial: string | null;
}

export function FastbootGetVarCard({ deviceMode, deviceSerial }: FastbootGetVarCardProps) {
  const isFastboot = deviceMode === 'fastboot';
  const [variablesRaw, setVariablesRaw] = useState<string>('');
  const [isLoadingVars, setIsLoadingVars] = useState<boolean>(false);
  const [varSearch, setVarSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const handleQueryGetVars = useCallback(async () => {
    setIsLoadingVars(true);
    try {
      const output = await RunFastbootHostCommand('getvar all', deviceSerial);
      setVariablesRaw(output);
      handleSuccess('Fastboot getvar all', 'Fastboot variables parsed successfully');
    } catch (error) {
      handleError('Fastboot getvar all', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoadingVars(false);
    }
  }, [deviceSerial]);

  const parsedVariables = useMemo<VariableRow[]>(() => {
    if (!variablesRaw) {
      return [];
    }
    const lines = variablesRaw.split('\n');
    const rows: VariableRow[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('Finished.') || trimmed.startsWith('all:')) {
        return;
      }

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) {
        return;
      }

      const key = trimmed
        .slice(0, colonIdx)
        .trim()
        .replace(/^\(bootloader\)\s*/, '');
      const value = trimmed.slice(colonIdx + 1).trim();

      let category: VariableRow['category'] = 'misc';
      if (key.includes('slot') || key.includes('current-slot')) {
        category = 'slots';
      } else if (key.includes('secure') || key.includes('unlocked') || key.includes('lock')) {
        category = 'security';
      } else if (
        key.includes('product') ||
        key.includes('cpu') ||
        key.includes('board') ||
        key.includes('serial')
      ) {
        category = 'hardware';
      } else if (key.startsWith('partition-')) {
        category = 'partition';
      }

      rows.push({ category, key, value });
    });

    return rows;
  }, [variablesRaw]);

  const filteredVariables = useMemo(
    () =>
      parsedVariables.filter((row) => {
        const matchesCategory =
          selectedCategory === 'ALL' || row.category === selectedCategory.toLowerCase();
        const matchesSearch =
          !varSearch ||
          row.key.toLowerCase().includes(varSearch.toLowerCase()) ||
          row.value.toLowerCase().includes(varSearch.toLowerCase());
        return matchesCategory && matchesSearch;
      }),
    [parsedVariables, selectedCategory, varSearch],
  );

  const handleExportJson = async () => {
    if (parsedVariables.length === 0) {
      return;
    }
    try {
      const obj: Record<string, string> = {};
      parsedVariables.forEach((r) => {
        obj[r.key] = r.value;
      });
      await SaveLog(JSON.stringify(obj, null, 2), 'json');
      toast.success('Fastboot variables exported as JSON');
    } catch (error) {
      toast.error(`Failed to export: ${String(error)}`);
    }
  };

  return (
    <Card className="rounded-xl border-border bg-surface shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-semibold text-title">
            <Database className="size-4.5 text-primary" />
            Fastboot Variables Deep Inspector (getvar all)
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              {filteredVariables.length} / {parsedVariables.length} Variables
            </span>
          </div>
        </div>
        <CardDescription className="text-body text-muted-foreground">
          Query hardware registers, unlock states, max download sizes, and partition tables from
          bootloader
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3.5 pt-1">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex max-w-md flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-8 text-caption"
                onChange={(e) => setVarSearch(e.target.value)}
                placeholder="Search variables (e.g. secure, product, slot)…"
                value={varSearch}
              />
            </div>

            <div className="flex items-center gap-1">
              {['ALL', 'Hardware', 'Security', 'Slots'].map((cat) => (
                <Button
                  className="h-8 text-caption"
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  size="sm"
                  type="button"
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                >
                  {cat}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="h-8 gap-1.5 px-3 text-caption"
              disabled={isLoadingVars || !isFastboot}
              onClick={() => void handleQueryGetVars()}
              size="sm"
              type="button"
            >
              {isLoadingVars ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Query Variables
            </Button>

            {parsedVariables.length > 0 ? (
              <Button
                className="h-8 gap-1.5 px-3 text-caption"
                onClick={() => void handleExportJson()}
                size="sm"
                type="button"
                variant="outline"
              >
                <FileJson className="size-3.5 text-muted-foreground" />
                Export JSON
              </Button>
            ) : null}
          </div>
        </div>

        {/* Variables Table */}
        <div className="max-h-[360px] min-h-[200px] overflow-y-auto rounded-lg border border-border/80 bg-background/90 font-mono text-[11px]">
          {filteredVariables.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-caption text-muted-foreground">
              {isFastboot
                ? 'Click "Query Variables" to fetch bootloader parameters.'
                : 'Connect a device in Fastboot mode to inspect getvar variables.'}
            </div>
          ) : (
            <table className="w-full divide-y divide-border/40 text-left">
              <thead className="sticky top-0 bg-surface-raised/80 text-[10px] text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-medium">Variable Key</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="w-12 px-3 py-2 text-right">Copy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredVariables.map((row) => (
                  <tr className="hover:bg-surface-raised/40" key={`${row.key}-${row.value}`}>
                    <td className="px-3 py-1.5 font-semibold text-primary">{row.key}</td>
                    <td className="px-3 py-1.5 text-foreground">{row.value}</td>
                    <td className="px-3 py-1.5 text-right">
                      <CopyButton value={`${row.key}: ${row.value}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
