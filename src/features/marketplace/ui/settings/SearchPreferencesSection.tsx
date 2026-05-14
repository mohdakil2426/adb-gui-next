import { SlidersHorizontal } from 'lucide-react';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';

export function SearchPreferencesSection({
  localPat,
  onLocalPatChange,
  onResultsPerProviderChange,
  resultsPerProvider,
}: {
  localPat: string;
  onLocalPatChange: (value: string) => void;
  onResultsPerProviderChange: (value: number) => void;
  resultsPerProvider: number;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 font-medium text-sm">
        <SlidersHorizontal className="size-4 text-muted-foreground" />
        Search preferences
      </div>
      <FieldSet>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="results-per-provider">Results per provider</FieldLabel>
            <Select
              onValueChange={(value) => onResultsPerProviderChange(Number(value))}
              value={String(resultsPerProvider)}
            >
              <SelectTrigger className="w-full" id="results-per-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {[6, 8, 12, 16].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="github-pat">Advanced fallback token</FieldLabel>
            <Input
              autoComplete="off"
              className="font-mono text-xs"
              id="github-pat"
              name="github-pat"
              onChange={(event) => onLocalPatChange(event.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              spellCheck={false}
              type="password"
              value={localPat}
            />
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldDescription>
        Personal access tokens are optional session-only fallbacks. They are kept in memory for the
        current app session and are not saved after reload or restart.
      </FieldDescription>
    </section>
  );
}
