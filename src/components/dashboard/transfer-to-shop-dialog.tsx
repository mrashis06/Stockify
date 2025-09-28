
"use client";

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { IndianRupee } from 'lucide-react';

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
import type { GodownItem } from '@/hooks/use-godown-inventory';

type TransferToShopDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: GodownItem; // Represents the grouped item, where id is productId and quantity is totalQuantity
  isNewToShop: boolean;
  onTransfer: (productId: string, quantity: number, price?: number) => void;
};

export default function TransferToShopDialog({ isOpen, onOpenChange, item, isNewToShop, onTransfer }: TransferToShopDialogProps) {
  
  const formSchema = z.object({
    quantity: z.coerce.number().int()
      .min(1, 'Quantity must be at least 1')
      .max(item.quantity, `Cannot transfer more than available stock (${item.quantity})`),
    price: isNewToShop 
      ? z.coerce.number().min(0, 'Price must be a positive number.')
      : z.coerce.number().optional(),
  });

  type TransferFormValues = z.infer<typeof formSchema>;
  
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: '' as any,
      price: '' as any,
    },
  });

  // Reset form when item changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset({ quantity: '' as any, price: '' as any });
    }
  }, [isOpen, item, form]);


  const onSubmit = (data: TransferFormValues) => {
    // The `id` on the item passed to this dialog is actually the `productId`
    onTransfer(item.id, data.quantity, data.price);
  };
  
  useEffect(() => {
    if (!isOpen) {
      form.reset();
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Transfer to Shop</DialogTitle>
          <DialogDescription>
             {isNewToShop 
                ? "This is a new product. Set its price and the quantity to transfer."
                : "Move stock from the godown to the main shop inventory. Batches will be used on a First-In, First-Out basis."
             }
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm">
            <p><strong>Item:</strong> {item.brand} ({item.size})</p>
            <p><strong>Available in Godown:</strong> {item.quantity} units</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity to Transfer</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter quantity" {...field} autoFocus={!isNewToShop} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isNewToShop && (
                 <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Set Product Price (₹)</FormLabel>
                      <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input type="number" placeholder="Enter sale price" {...field} className="pl-10" autoFocus={isNewToShop} />
                          </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}
            <DialogFooter>
               <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">Transfer</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
