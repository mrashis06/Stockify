
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryItem } from '@/hooks/use-inventory';
import { TriangleAlert } from 'lucide-react';
import { DialogClose } from '@radix-ui/react-dialog';

type LowStockDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  lowStockItems: InventoryItem[];
};

export default function LowStockDialog({ isOpen, onOpenChange, lowStockItems }: LowStockDialogProps) {

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-destructive"/>
            Low Stock Items
          </DialogTitle>
          <DialogDescription>
            The following items are running low on stock (less than 10 units remaining).
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <ScrollArea className="h-72 w-full rounded-md border">
                <Table>
                    <TableHeader className="sticky top-0 bg-muted">
                        <TableRow>
                            <TableHead className="font-bold text-foreground">Brand</TableHead>
                            <TableHead className="font-bold text-foreground">Size</TableHead>
                            <TableHead className="font-bold text-foreground text-right">Remaining</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lowStockItems.length > 0 ? (
                           lowStockItems.map(item => (
                               <TableRow key={item.id}>
                                   <TableCell className="font-medium">{item.brand}</TableCell>
                                   <TableCell>{item.size}</TableCell>
                                   <TableCell className="text-right font-bold text-destructive">{item.closing}</TableCell>
                               </TableRow>
                           ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                    No items are currently low on stock.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
