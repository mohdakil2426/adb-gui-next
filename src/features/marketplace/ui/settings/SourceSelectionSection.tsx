import { ShieldCheck } from 'lucide-react';
import type { backend } from '@/desktop/models';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldTitle } from '@/shared/ui/field';
import { Switch } from '@/shared/ui/switch';

type ProviderSource = backend.ProviderSource;

const PROVIDERS: { description: string; id: ProviderSource; label: string }[] = [
  { id: 'F-Droid', label: 'F-Droid', description: 'Free and open-source Android apps' },
  {
    id: 'GitHub',
    label: 'GitHub Releases',
    description: 'Open-source repositories with release assets',
  },
  {
    id: 'Aptoide',
    label: 'Aptoide',
    description: 'Consumer app store with trusted-package filtering',
  },
];

export function SourceSelectionSection({
  activeProviders,
  toggleProvider,
}: {
  activeProviders: ProviderSource[];
  toggleProvider: (provider: ProviderSource) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2 font-medium text-sm">
        <ShieldCheck className="size-4 text-muted-foreground" />
        Source selection
      </div>
      <FieldGroup>
        {PROVIDERS.map((provider) => (
          <Field
            className="justify-between rounded-lg border px-3 py-3"
            data-disabled={activeProviders.includes(provider.id) && activeProviders.length <= 1}
            key={provider.id}
            orientation="horizontal"
          >
            <FieldContent className="pr-4">
              <FieldTitle>{provider.label}</FieldTitle>
              <FieldDescription>{provider.description}</FieldDescription>
            </FieldContent>
            <Switch
              aria-label={`Enable ${provider.label}`}
              checked={activeProviders.includes(provider.id)}
              disabled={activeProviders.includes(provider.id) && activeProviders.length <= 1}
              onCheckedChange={() => toggleProvider(provider.id)}
            />
          </Field>
        ))}
      </FieldGroup>
    </section>
  );
}
