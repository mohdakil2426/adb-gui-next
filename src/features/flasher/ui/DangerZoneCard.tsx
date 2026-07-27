import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

export function DangerZoneCard({
  disabled,
  isLoading,
  onWipe,
  serial,
}: {
  disabled: boolean;
  isLoading: boolean;
  onWipe: () => void;
  serial: string | null;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          These actions are irreversible and will erase data on your device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          className="w-full"
          disabled={disabled}
          onClick={() => {
            setConfirming(true);
          }}
          variant="destructive"
        >
          {isLoading ? (
            <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
          ) : (
            <Trash2 className="mr-2 size-4 shrink-0" />
          )}
          Wipe Data (Factory Reset)
        </Button>
      </CardContent>

      <ConfirmDialog
        confirmLabel="Yes, Wipe Data"
        consequence={
          <p>
            All photos, files, accounts and settings are erased. There is no undo and no backup is
            taken.
          </p>
        }
        description="Performs a full factory reset by erasing the userdata partition over fastboot."
        details={[{ label: 'Target', mono: true, value: serial ?? 'the selected device' }]}
        onConfirm={onWipe}
        onOpenChange={setConfirming}
        open={confirming}
        title="Erase all user data?"
      />
    </Card>
  );
}
