
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
  
  const formSchema = z.object({
    servingSize: z.coerce.number().int()
      .min(1, 'Serving size must be at least 1ml')
      .max(item.remainingVolume, `Cannot sell more than remaining volume (${item.remainingVolume}ml)`),
    salePrice: z.coerce.number().min(0, 'Price must be a non-negative number'),
  });

  type SellFormValues = z.infer<typeof formSchema>;
  
  const form = useForm<SellFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      servingSize: 30, // Default to a standard peg
      salePrice: 0,
    },
  });

  const onSubmit = (data: SellFormValues) => {
    onSell(item.id, data.servingSize, data.salePrice);
  };
  
  useEffect(() => {
    if (isOpen) {
      // Reset form when dialog opens or item changes
      form.reset({ servingSize: 30, salePrice: 0 });
    }
  }, [isOpen, item, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sell Peg</DialogTitle>
          <DialogDescription>
            Enter the serving size and sale price for this transaction.
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm space-y-1 py-2">
            <p><strong>Item:</strong> {item.brand} ({item.size})</p>
            <p><strong>Available:</strong> {item.remainingVolume}ml / {item.totalVolume}ml</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="servingSize"
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
             <FormField
              control={form.control}
              name="salePrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sale Price (₹)</FormLabel>
                   <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input type="number" {...field} className="pl-10" />
                        </FormControl>
                   </div>
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
              <Button type="submit" className="bg-green-600 hover:bg-green-700">Sell</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
