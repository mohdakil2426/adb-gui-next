import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { getNickname, setNickname } from '@/lib/nicknameStore';
import { toast } from 'sonner';

interface EditNicknameDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  serial: string | null;
  onSaved: () => void;
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
      setNewNickname(getNickname(serial) || '');
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Nickname</DialogTitle>
          <DialogDescription>
            Give a nickname to the device:
            <span className="block font-mono text-foreground mt-2">{serial}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label htmlFor="nickname" className="text-left">
            Nickname
          </Label>
          <Input
            id="nickname"
            value={newNickname}
            onChange={(e) => setNewNickname(e.target.value)}
            placeholder="Ex: My Device"
            className="mt-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveNickname();
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveNickname}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
