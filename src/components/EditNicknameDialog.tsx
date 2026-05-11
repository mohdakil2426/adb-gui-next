import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getNickname, setNickname } from '@/lib/nicknameStore';

interface EditNicknameDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  serial: string | null;
}

export function EditNicknameDialog({
  isOpen,
  onOpenChange,
  serial,
  onSaved,
}: EditNicknameDialogProps) {
  const [newNickname, setNewNickname] = useState('');

  useEffect(() => {
    if (isOpen && serial) {
      setNewNickname(getNickname(serial) ?? '');
    }
  }, [isOpen, serial]);

  const handleSaveNickname = () => {
    if (serial) {
      setNickname(serial, newNickname);
      toast.success(`Nickname saved for ${serial}`);
      onSaved();
    }
    onOpenChange(false);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Nickname</DialogTitle>
          <DialogDescription>
            Give a nickname to the device:
            <span className="mt-2 block font-mono text-foreground">{serial}</span>
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="py-4">
          <Field>
            <FieldLabel htmlFor="nickname">Nickname</FieldLabel>
            <Input
              autoComplete="off"
              id="nickname"
              name="nickname"
              onChange={(e) => {
                setNewNickname(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveNickname();
                }
              }}
              placeholder="Ex: My Device"
              value={newNickname}
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            onClick={() => {
              onOpenChange(false);
            }}
            variant="outline"
          >
            Cancel
          </Button>
          <Button onClick={handleSaveNickname}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
