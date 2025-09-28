

"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import type { InventoryItem } from '@/hooks/use-inventory';

type TransferToShopDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: InventoryItem; 
  onTransfer: (productId: string, quantity: number, price?: number) => void;
};

export default function TransferToShopDialog({ isOpen, onOpenChange, item, onTransfer }: TransferToShopDialogProps) {
  
  // A product is considered "new" to the shop if it has no price set.
  const isNewProduct = item && item.price === 0;

  const formSchema = z.object({
    quantity: z.coerce.number().int()
      .min(1, 'Quantity must be at least 1')
      .max(item.stockInGodown, `Cannot transfer more than available in godown (${item.stockInGodown})`),
    price: isNewProduct 
      ? z.coerce.number().min(0.01, 'Price must be a positive number.')
      : z.coerce.number().optional(),
  });

  type TransferFormValues = z.infer<typeof formSchema>;
  
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: '' as any,
      price: item?.price > 0 ? item.price : ('' as any),
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        quantity: '' as any,
        price: item.price > 0 ? item.price : ('' as any),
      });
    }
  }, [item, form]);

  const onSubmit = (data: TransferFormValues) => {
    onTransfer(item.id, data.quantity, data.price);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer to Shop</DialogTitle>
           <DialogDescription>
             Transferring: {item?.brand} ({item?.size})
          </DialogDescription>
        </DialogHeader>
        
        <div className="text-sm">
            <span className="font-semibold">Available in Godown:</span> {item?.stockInGodown || 0} units
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            {isNewProduct && (
                <Alert variant="destructive">
                    <Info className="h-4 w-4" />
                    <AlertTitle>New Product</AlertTitle>
                    <AlertDescription>
                        This product has no price. Please set a selling price before transferring.
                    </AlertDescription>
                </Alert>
            )}
            
            {isNewProduct && (
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Set Product Price (₹)</FormLabel>
                      <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input type="number" placeholder="Enter sale price" {...field} className="pl-10" />
                          </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity to Transfer</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter quantity" {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                </DialogClose>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">Confirm Transfer</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
