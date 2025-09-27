
"use client";

import React, { useEffect, useState } from 'react';
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
import type { OnBarItem } from '@/hooks/use-onbar-inventory';
import { IndianRupee } from 'lucide-react';

type SellOnBarItemDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: OnBarItem;
  onSell: (id: string, volume: number, price: number) => void;
};

export default function SellOnBarItemDialog({ isOpen, onOpenChange, item, onSell }: SellOnBarItemDialogProps) {
  const isBeer = item.category === 'Beer';

  // We use a dynamic schema based on whether the item is beer or not
  const formSchema = isBeer 
    ? z.object({
        quantity: z.coerce.number().int()
          .min(1, 'Quantity must be at least 1 unit.')
          .max(item.remainingVolume, `Cannot sell more than available units (${item.remainingVolume})`),
      })
    : z.object({
        servingSize: z.coerce.number().int()
          .min(1, 'Serving size must be at least 1ml')
          .max(item.remainingVolume, `Cannot sell more than remaining volume (${item.remainingVolume}ml)`),
        salePrice: z.coerce.number().min(0, 'Price must be a non-negative number'),
      });

  type SellFormValues = z.infer<typeof formSchema>;
  
  const form = useForm<SellFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: isBeer ? { quantity: '' as any } : { servingSize: 30, salePrice: '' as any },
  });
  
  const quantity = form.watch(isBeer ? 'quantity' : undefined);
  const calculatedPrice = isBeer && quantity ? item.price * quantity : 0;

  const onSubmit = (data: SellFormValues) => {
    if (isBeer) {
      const { quantity } = data as { quantity: number };
      onSell(item.id, quantity, item.price * quantity);
    } else {
      const { servingSize, salePrice } = data as { servingSize: number; salePrice: number };
      onSell(item.id, servingSize, salePrice);
    }
  };
  
  useEffect(() => {
    if (isOpen) {
      form.reset(isBeer ? { quantity: '' as any } : { servingSize: 30, salePrice: '' as any });
    }
  }, [isOpen, item, form, isBeer]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isBeer ? 'Sell Beer' : 'Sell Peg'}</DialogTitle>
          <DialogDescription>
             {isBeer ? 'Enter the number of units to sell.' : 'Enter the serving size and sale price for this transaction.'}
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm space-y-1 py-2">
            <p><strong>Item:</strong> {item.brand} ({item.size})</p>
            <p><strong>Available:</strong> {item.remainingVolume} {isBeer ? 'units' : 'ml'}</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {isBeer ? (
              <>
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity to Sell (units)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Enter quantity" {...field} autoFocus />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="text-sm font-medium">
                    Total Price: <span className="font-bold">₹{calculatedPrice.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="servingSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serving Size (ml)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g. 30" {...field} autoFocus />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="salePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sale Price (₹)</FormLabel>
                       <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <FormControl>
                              <Input type="number" placeholder="Enter price" {...field} className="pl-10" />
                            </FormControl>
                       </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <DialogFooter>
               <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" className="bg-green-600 hover:bg-green-700">Sell</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
