import React, { useState, useEffect } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getNickname, setNickname } from "@/lib/nicknameStore";
import { toast } from "sonner";

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
    const [newNickname, setNewNickname] = useState("");

    useEffect(() => {
        if (isOpen && serial) {
            setNewNickname(getNickname(serial) || "");
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
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Edit Nickname</AlertDialogTitle>
                    <AlertDialogDescription>
                        Give a nickname to the device:
                        <span className="block font-mono text-foreground mt-2">{serial}</span>
                    </AlertDialogDescription>
                </AlertDialogHeader>

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
                    />
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSaveNickname}>Save</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
