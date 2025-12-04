
"use client";

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { IndianRupee, Info } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import type { InventoryItem } from '@/hooks/use-inventory';
import { useMediaQuery } from 'react-responsive';
import { Card } from '../ui/card';

type BulkTransferItem = {
  productId: string;
  brand: string;
  size: string;
  stockInGodown: number;
  isNewProduct: boolean;
  price?: number;
  quantity: number | '';
};

const itemSchema = z.object({
  productId: z.string(),
  brand: z.string(),
  size: z.string(),
  stockInGodown: z.number(),
  isNewProduct: z.boolean(),
  price: z.coerce.number().optional(),
  quantity: z.coerce.number().int().min(0, "Must be 0 or more"),
}).refine(data => data.quantity <= data.stockInGodown, {
  message: "Cannot transfer more than available stock",
  path: ['quantity'],
}).refine(data => !data.isNewProduct || (data.price && data.price > 0), {
  message: "Price is required for new products",
  path: ['price'],
});

const formSchema = z.object({
  items: z.array(itemSchema),
});

type BulkTransferFormValues = z.infer<typeof formSchema>;

type BulkTransferDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  items: InventoryItem[];
  onBulkTransfer: (itemsToTransfer: { productId: string; quantity: number; price?: number }[]) => Promise<void>;
};

export default function BulkTransferDialog({ isOpen, onOpenChange, items, onBulkTransfer }: BulkTransferDialogProps) {
  const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
  const form = useForm<BulkTransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      items: [],
    },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (items) {
      const formItems: BulkTransferItem[] = items.map(item => ({
        productId: item.id,
        brand: item.brand,
        size: item.size,
        stockInGodown: item.stockInGodown,
        isNewProduct: item.price === 0,
        price: item.price > 0 ? item.price : undefined,
        quantity: '',
      }));
      replace(formItems);
    }
  }, [items, replace]);

  const onSubmit = (data: BulkTransferFormValues) => {
    const itemsToTransfer = data.items
      .filter(item => item.quantity > 0)
      .map(({ productId, quantity, price }) => ({ productId, quantity, price }));
    
    if (itemsToTransfer.length > 0) {
      onBulkTransfer(itemsToTransfer);
    } else {
      onOpenChange(false); // Close if no items to transfer
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk Transfer to Shop</DialogTitle>
          <DialogDescription>
            Enter the quantity to transfer for each selected item.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] md:h-[50vh] pr-4">
              {isMobile ? (
                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <Card key={field.id} className="p-4 space-y-3">
                       <div>
                          <h3 className="font-bold">{field.brand}</h3>
                          <p className="text-sm text-muted-foreground">{field.size} &bull; Available: {field.stockInGodown}</p>
                      </div>
                       {field.isNewProduct && (
                        <Alert variant="destructive" className="py-2 px-3">
                          <Info className="h-4 w-4" />
                          <AlertDescription>New Product: Please set a price.</AlertDescription>
                        </Alert>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        {field.isNewProduct && (
                             <FormField
                                control={form.control}
                                name={`items.${index}.price`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Price</FormLabel>
                                        <div className="relative">
                                          <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                          <FormControl><Input type="number" placeholder="Set Price" {...field} className="h-9 pl-6" /></FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field: qtyField }) => (
                            <FormItem className={!field.isNewProduct ? "col-span-2" : ""}>
                              <FormLabel>Quantity</FormLabel>
                              <FormControl><Input type="number" placeholder="0" {...qtyField} className="h-9"/></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Brand</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead className={fields.some(f => f.isNewProduct) ? "w-32" : "hidden"}>Price</TableHead>
                      <TableHead className="w-32">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell className="font-medium">{field.brand}</TableCell>
                        <TableCell>{field.size}</TableCell>
                        <TableCell>{field.stockInGodown}</TableCell>
                        <TableCell className={fields.some(f => f.isNewProduct) ? "" : "hidden"}>
                          {field.isNewProduct ? (
                            <FormField
                                control={form.control}
                                name={`items.${index}.price`}
                                render={({ field }) => (
                                    <FormItem>
                                         <div className="relative">
                                          <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                          <FormControl><Input type="number" placeholder="Set Price" {...field} className="h-8 pl-6"/></FormControl>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                          ) : (
                            <span className="text-muted-foreground flex items-center">
                                <IndianRupee className="h-3 w-3 mr-1" />
                                {field.price}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                           <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field: qtyField }) => (
                                <FormItem>
                                  <FormControl><Input type="number" placeholder="0" {...qtyField} className="h-8"/></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
            <DialogFooter className="pt-6">
                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit">Confirm & Transfer</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
