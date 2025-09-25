
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDateFormat } from '@/hooks/use-date-format';
import type { Notification } from '@/hooks/use-notifications';
import { ScrollArea } from '../ui/scroll-area';

type NotificationDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  notification: Notification;
};

export default function NotificationDialog({ isOpen, onOpenChange, notification }: NotificationDialogProps) {
  const { formatDate } = useDateFormat();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{notification.title}</DialogTitle>
          <DialogDescription className="text-xs pt-1">
            Sent by {notification.author || 'Admin'} on {formatDate(notification.createdAt.toDate(), 'PPP p')}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <ScrollArea className="h-40 w-full rounded-md border p-4">
                <p className="text-sm whitespace-pre-wrap">{notification.description}</p>
            </ScrollArea>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
