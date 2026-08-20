import { SlidersHorizontal } from 'lucide-react';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet } from '@/shared/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';

export function SearchPreferencesSection({
  onResultsPerProviderChange,
  resultsPerProvider,
}: {
  onResultsPerProviderChange: (value: number) => void;
  resultsPerProvider: number;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 font-medium text-body">
        <SlidersHorizontal className="size-4 text-muted-foreground" />
        Search preferences
      </div>
      <FieldSet>
        <FieldGroup className="grid grid-cols-1 gap-4">
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
        </FieldGroup>
      </FieldSet>
      <FieldDescription>
        GitHub authentication is handled in the GitHub section above (OS keychain, no setup needed).
      </FieldDescription>
    </section>
  );
}
