
"use client";

import React from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';

type ProfilePictureDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  imageUrl: string;
  userName: string;
  onEditClick: () => void;
};

export default function ProfilePictureDialog({ isOpen, onOpenChange, imageUrl, userName, onEditClick }: ProfilePictureDialogProps) {
  
  const handleEdit = () => {
    onOpenChange(false); // Close the dialog
    onEditClick(); // Trigger the upload
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Profile Picture</DialogTitle>
        </DialogHeader>
        <div className="p-6 pt-2">
            <div className="relative aspect-square w-full mx-auto rounded-lg overflow-hidden border">
                <Image
                    src={imageUrl}
                    alt={`${userName}'s profile picture`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
            </div>
        </div>
        <DialogFooter className="p-6 pt-0 grid grid-cols-2 gap-2">
           <Button onClick={() => onOpenChange(false)} variant="secondary" className="w-full">Close</Button>
          <Button onClick={handleEdit} className="w-full">
            <Pencil className="mr-2 h-4 w-4" />
            Change Picture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
