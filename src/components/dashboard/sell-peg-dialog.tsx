
"use client";

import React, { useEffect, useState, useMemo } from 'react';
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
import { OnBarItem } from '@/hooks/use-onbar-inventory';
import { IndianRupee } from 'lucide-react';

type SellPegDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: OnBarItem;
  onSell: (id: string, quantity: number) => void;
};

export default function SellPegDialog({ isOpen, onOpenChange, item, onSell }: SellPegDialogProps) {
  
  const formSchema = z.object({
    quantity: z.coerce.number().int()
      .min(1, 'Serving size must be at least 1ml')
      .max(item.remainingVolume, `Cannot sell more than available (${item.remainingVolume}ml)`),
  });

  type SellPegFormValues = z.infer<typeof formSchema>;
  
  const form = useForm<SellPegFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 30,
    },
  });

  const quantity = form.watch('quantity');

  const calculatedPrice = useMemo(() => {
    if (!item || !quantity || isNaN(quantity) || quantity <= 0) return 0;
    const pricePerMl = item.price / item.totalVolume;
    return pricePerMl * quantity;
  }, [item, quantity]);


  const onSubmit = (data: SellPegFormValues) => {
    onSell(item.id, data.quantity);
  };
  
  useEffect(() => {
    if (isOpen) {
      form.reset({ quantity: 30 });
    }
  }, [isOpen, item, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sell Peg</DialogTitle>
          <DialogDescription>
            Enter the serving size in ml to sell from this bottle.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm space-y-1">
            <p><strong>Item:</strong> {item.brand} ({item.size})</p>
            <p><strong>Available:</strong> {item.remainingVolume}ml / {item.totalVolume}ml</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Serving Size (ml)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="bg-muted/50 p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Calculated Price</p>
                <p className="text-2xl font-bold flex items-center justify-center">
                    <IndianRupee className="h-6 w-6 mr-1" />
                    {calculatedPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
            </div>

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

