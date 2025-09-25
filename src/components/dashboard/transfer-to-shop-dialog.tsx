
"use client";

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

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
// The item prop is now a grouped item, but we only need productId and total quantity
// so the GodownItem type is close enough for the structure.
import type { GodownItem } from '@/hooks/use-godown-inventory';

type TransferToShopDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: GodownItem; // Represents the grouped item, where id is productId and quantity is totalQuantity
  onTransfer: (productId: string, quantity: number) => void;
};

export default function TransferToShopDialog({ isOpen, onOpenChange, item, onTransfer }: TransferToShopDialogProps) {
  
  const formSchema = z.object({
    quantity: z.coerce.number().int()
      .min(1, 'Quantity must be at least 1')
      .max(item.quantity, `Cannot transfer more than available stock (${item.quantity})`),
  });

  type TransferFormValues = z.infer<typeof formSchema>;
  
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
    },
  });

  // Reset form when item changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset({ quantity: 1 });
      // The schema is dependent on `item.quantity`, so it's re-created on each render.
      // We may need to ensure the form re-evaluates against the new schema.
      // `form.trigger()` can help, or simply relying on the re-render.
    }
  }, [isOpen, item, form]);


  const onSubmit = (data: TransferFormValues) => {
    // The `id` on the item passed to this dialog is actually the `productId`
    onTransfer(item.id, data.quantity);
    form.reset(); // Reset the form to default values after successful submission
  };
  
  // This is redundant with the above useEffect, but harmless.
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
            Move stock from the godown to the main shop inventory. Batches will be used on a First-In, First-Out basis.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm">
            <p><strong>Item:</strong> {item.brand} ({item.size})</p>
            <p><strong>Available in Godown:</strong> {item.quantity} units</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity to Transfer</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
