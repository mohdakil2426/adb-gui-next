import { AlertTriangle } from 'lucide-react';
import { Fragment, type ReactNode, useId, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { buttonVariants } from '@/shared/ui/button-variants';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { cn } from '@/shared/utils/cn';

/** One `label → value` row in the "exactly what is about to happen" summary. */
export interface ConfirmDetail {
  label: string;
  /** Render the value in the monospace face (serials, paths, partitions). */
  mono?: boolean;
  value: ReactNode;
}

export interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel: string;
  /**
   * When set, the confirm button stays disabled until the user types this exact
   * string. Reserved for actions whose blast radius is a bricked or wiped device.
   */
  confirmPhrase?: string | undefined;
  /** Overrides the default "Type <phrase> to confirm" prompt. */
  confirmPhraseHint?: ReactNode;
  /** What goes wrong if this is the wrong call. Rendered as a highlighted banner. */
  consequence?: ReactNode;
  description: ReactNode;
  /** `false` renders the affirmative action in the primary style. Defaults to `true`. */
  destructive?: boolean;
  /** Concrete target facts — device, partition, file. Never paraphrase them. */
  details?: ConfirmDetail[];
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

/**
 * The single confirmation primitive for destructive actions.
 *
 * Every irreversible operation in the app routes through this component so the
 * user sees one consistent shape: what is about to happen, to which device, and
 * what it costs if it is wrong. Do not hand-roll another confirmation dialog.
 */
export function ConfirmDialog({
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmPhrase,
  confirmPhraseHint,
  consequence,
  description,
  details,
  destructive = true,
  onConfirm,
  onOpenChange,
  open,
  title,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const inputId = useId();

  const needsPhrase = Boolean(confirmPhrase);
  const phraseMatches = !needsPhrase || typed.trim() === confirmPhrase;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTyped('');
    }
    onOpenChange?.(next);
  };
  return (
    <AlertDialog onOpenChange={handleOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle
              aria-hidden="true"
              className={cn('size-4 shrink-0', destructive ? 'text-destructive' : 'text-warning')}
            />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {details && details.length > 0 ? (
          <dl className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-md border bg-muted/40 px-3 py-2.5 text-body">
            {details.map((detail) => (
              <Fragment key={detail.label}>
                <dt className="truncate text-label text-muted-foreground">{detail.label}</dt>
                <dd className={cn('min-w-0 break-words', detail.mono && 'font-mono text-mono')}>
                  {detail.value}
                </dd>
              </Fragment>
            ))}
          </dl>
        ) : null}

        {consequence ? (
          <div
            className={cn(
              'flex gap-2 rounded-md border px-3 py-2.5 text-body',
              destructive
                ? 'border-destructive/30 bg-destructive-muted'
                : 'border-warning/30 bg-warning-muted',
            )}
          >
            <AlertTriangle
              aria-hidden="true"
              className={cn(
                'mt-0.5 size-4 shrink-0',
                destructive ? 'text-destructive' : 'text-warning',
              )}
            />
            <div className="min-w-0">{consequence}</div>
          </div>
        ) : null}

        {needsPhrase ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={inputId}>
              {confirmPhraseHint ?? (
                <span>
                  Type <span className="font-mono text-mono">{confirmPhrase}</span> to confirm
                </span>
              )}
            </Label>
            <Input
              autoComplete="off"
              id={inputId}
              onChange={(event) => {
                setTyped(event.target.value);
              }}
              placeholder={confirmPhrase}
              spellCheck={false}
              value={typed}
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: destructive ? 'destructive' : 'default' })}
            disabled={!phraseMatches}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
