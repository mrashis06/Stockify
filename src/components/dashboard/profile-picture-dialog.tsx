
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

type ProfilePictureDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  imageUrl: string;
  userName: string;
};

export default function ProfilePictureDialog({ isOpen, onOpenChange, imageUrl, userName }: ProfilePictureDialogProps) {
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
        <DialogFooter className="p-6 pt-0">
          <Button onClick={() => onOpenChange(false)} className="w-full">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
