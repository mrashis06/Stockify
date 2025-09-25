
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '../ui/badge';

type LowStockDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  lowStockItems: InventoryItem[];
  outOfStockItems: InventoryItem[];
};

const StockListTable = ({ items }: { items: InventoryItem[] }) => (
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
                {items.length > 0 ? (
                    items.map(item => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.brand}</TableCell>
                            <TableCell>{item.size}</TableCell>
                            <TableCell className="text-right font-bold text-destructive">{item.closing}</TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                            No items in this category.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    </ScrollArea>
);


export default function LowStockDialog({ isOpen, onOpenChange, lowStockItems, outOfStockItems }: LowStockDialogProps) {

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-destructive"/>
            Stock Alerts
          </DialogTitle>
          <DialogDescription>
            The following items need your attention. Items that were newly added today are excluded from this list.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
            <Tabs defaultValue="low_stock" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="low_stock">
                        Low Stock <Badge variant="destructive" className="ml-2">{lowStockItems.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="out_of_stock">
                        Out of Stock <Badge variant="destructive" className="ml-2">{outOfStockItems.length}</Badge>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="low_stock" className="mt-4">
                    <StockListTable items={lowStockItems} />
                </TabsContent>
                <TabsContent value="out_of_stock" className="mt-4">
                     <StockListTable items={outOfStockItems} />
                </TabsContent>
            </Tabs>
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
