
"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { IndianRupee, Loader2 } from 'lucide-react';

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
import type { InventoryItem } from '@/hooks/use-inventory';

type TransferToOnBarDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: InventoryItem; 
  onTransfer: (productId: string, quantity: number, pegPrices?: { '30ml': number, '60ml': number }) => Promise<void>;
};

export default function TransferToOnBarDialog({ isOpen, onOpenChange, item, onTransfer }: TransferToOnBarDialogProps) {
  
  const isBeer = item?.category === 'Beer';
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formSchema = z.object({
    quantity: z.coerce.number().int()
      .min(1, 'Quantity must be at least 1')
      .max(item.stockInGodown, `Cannot transfer more than available in godown (${item.stockInGodown})`),
    pegPrice30ml: isBeer ? z.coerce.number().optional() : z.coerce.number().min(0.01, "Price is required"),
    pegPrice60ml: z.coerce.number().optional(),
  });

  type TransferFormValues = z.infer<typeof formSchema>;
  
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: 1,
      pegPrice30ml: '' as any,
      pegPrice60ml: '' as any,
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        quantity: 1,
        pegPrice30ml: '' as any,
        pegPrice60ml: '' as any,
      });
    } else {
        setIsSubmitting(false);
    }
  }, [isOpen, item, form]);

  const onSubmit = async (data: TransferFormValues) => {
    setIsSubmitting(true);
    try {
        const pegPrices = data.pegPrice30ml 
            ? { '30ml': data.pegPrice30ml, '60ml': data.pegPrice60ml || data.pegPrice30ml * 2 }
            : undefined;

        await onTransfer(item.id, data.quantity, pegPrices);
    } catch(error) {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer to On-Bar</DialogTitle>
           <DialogDescription>
             Opening: {item?.brand} ({item?.size})
          </DialogDescription>
        </DialogHeader>
        
        <div className="text-sm">
            <span className="font-semibold">Available in Godown:</span> {item?.stockInGodown || 0} units
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity to Transfer (units)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter quantity" {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {!isBeer && (
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="pegPrice30ml" render={({ field }) => (
                         <FormItem>
                            <FormLabel>30ml Peg Price</FormLabel>
                            <div className="relative">
                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl><Input type="number" placeholder="e.g. 100" {...field} className="pl-8" /></FormControl>
                            </div>
                            <FormMessage />
                         </FormItem>
                    )} />
                    <FormField control={form.control} name="pegPrice60ml" render={({ field }) => (
                         <FormItem>
                            <FormLabel>60ml Peg Price</FormLabel>
                             <div className="relative">
                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl><Input type="number" placeholder="e.g. 200" {...field} className="pl-8" /></FormControl>
                             </div>
                            <FormMessage />
                         </FormItem>
                    )} />
                </div>
            )}

            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isSubmitting}>Cancel</Button>
                </DialogClose>
                <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Transfer
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
