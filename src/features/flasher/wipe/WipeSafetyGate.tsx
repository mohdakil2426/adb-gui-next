import { AlertTriangle, Lock, ShieldAlert, Unlock } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Input } from '@/shared/ui/input';

interface WipeSafetyGateProps {
  isConfirmed?: boolean;
  onConfirmationChange: (confirmed: boolean) => void;
  serial: string | null;
}

export function WipeSafetyGate({
  serial,
  isConfirmed: _isConfirmed,
  onConfirmationChange,
}: WipeSafetyGateProps) {
  const [agreeDataLoss, setAgreeDataLoss] = useState(false);
  const [agreeTargetDevice, setAgreeTargetDevice] = useState(false);
  const [confirmWord, setConfirmWord] = useState('');

  const isWordValid = confirmWord.trim().toUpperCase() === 'WIPE';
  const allConditionsMet = agreeDataLoss && agreeTargetDevice && isWordValid;

  const handleToggleLoss = (checked: boolean) => {
    setAgreeDataLoss(checked);
    onConfirmationChange(checked && agreeTargetDevice && isWordValid);
  };

  const handleToggleTarget = (checked: boolean) => {
    setAgreeTargetDevice(checked);
    onConfirmationChange(agreeDataLoss && checked && isWordValid);
  };

  const handleWordChange = (val: string) => {
    setConfirmWord(val);
    const valid = val.trim().toUpperCase() === 'WIPE';
    onConfirmationChange(agreeDataLoss && agreeTargetDevice && valid);
  };

  return (
    <Card className="rounded-xl border-destructive/40 bg-destructive/5 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-destructive text-title">
            <ShieldAlert className="size-5" />
            Safety Interlock Gate
          </CardTitle>
          <Badge
            className="font-mono text-[10px]"
            variant={allConditionsMet ? 'success' : 'destructive'}
          >
            {allConditionsMet ? (
              <span className="flex items-center gap-1">
                <Unlock className="size-3" />
                GATE UNLOCKED
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Lock className="size-3" />
                GATE LOCKED
              </span>
            )}
          </Badge>
        </div>
        <CardDescription className="text-caption">
          Destructive hardware erase actions are strictly locked behind explicit triple safety
          confirmation.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3.5">
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Irreversible Partition Erase Warning</AlertTitle>
          <AlertDescription className="text-caption">
            Executing erase operations on NAND storage partitions cannot be undone. Target hardware:{' '}
            <strong className="font-mono">{serial ?? 'No Fastboot Device Connected'}</strong>.
          </AlertDescription>
        </Alert>

        {/* Checkbox 1 */}
        <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-surface p-3 transition-colors hover:border-destructive/40">
          <Checkbox
            checked={agreeDataLoss}
            className="mt-0.5"
            id="agree-data-loss"
            onCheckedChange={(checked) => handleToggleLoss(Boolean(checked))}
          />
          <label className="flex cursor-pointer flex-col" htmlFor="agree-data-loss">
            <span className="font-semibold text-body text-foreground">
              Acknowledge Permanent Data Destruction
            </span>
            <span className="text-caption text-muted-foreground">
              I understand that all photos, apps, keys, and settings on this device will be erased
              permanently without backup.
            </span>
          </label>
        </div>

        {/* Checkbox 2 */}
        <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-surface p-3 transition-colors hover:border-destructive/40">
          <Checkbox
            checked={agreeTargetDevice}
            className="mt-0.5"
            id="agree-target-device"
            onCheckedChange={(checked) => handleToggleTarget(Boolean(checked))}
          />
          <label className="flex cursor-pointer flex-col" htmlFor="agree-target-device">
            <span className="font-semibold text-body text-foreground">
              Verify Target Hardware Identity
            </span>
            <span className="text-caption text-muted-foreground">
              I have checked the serial{' '}
              <strong className="font-mono text-foreground">{serial || '(none)'}</strong> and
              confirm this is the intended hardware target.
            </span>
          </label>
        </div>
        {/* Type to confirm WIPE */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/80 bg-surface p-3">
          <span className="font-semibold text-body text-foreground">
            Type <span className="font-bold font-mono text-destructive">WIPE</span> to Authorize
          </span>
          <Input
            aria-label="Type WIPE to authorize data wipe"
            className="font-mono uppercase"
            onChange={(e) => handleWordChange(e.target.value)}
            placeholder="Type WIPE here..."
            value={confirmWord}
          />
        </div>
      </CardContent>
    </Card>
  );
}
