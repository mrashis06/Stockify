
"use client";

import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { IndianRupee, Info } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';

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
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card } from '../ui/card';
import type { InventoryItem } from '@/hooks/use-inventory';

const LIQUOR_CATEGORIES = ['Whiskey', 'Rum', 'Vodka', 'Gin', 'Tequila'];

type BulkTransferOnBarItem = {
  productId: string;
  brand: string;
  size: string;
  category: string;
  stockInGodown: number;
  price: number;
  quantity: number;
  pegPrice30ml?: number;
  pegPrice60ml?: number;
};

const itemSchema = z.object({
  productId: z.string(),
  brand: z.string(),
  size: z.string(),
  category: z.string(),
  stockInGodown: z.number(),
  price: z.number(),
  quantity: z.coerce.number().int().min(0, "Must be non-negative"),
  pegPrice30ml: z.coerce.number().optional(),
  pegPrice60ml: z.coerce.number().optional(),
}).refine(data => data.quantity <= data.stockInGodown, {
  message: "Cannot transfer more than available stock",
  path: ['quantity'],
}).refine(data => {
    if (LIQUOR_CATEGORIES.includes(data.category) && data.quantity > 0) {
        return data.pegPrice30ml && data.pegPrice30ml > 0;
    }
    return true;
}, {
    message: "30ml price is required for liquor.",
    path: ['pegPrice30ml'],
});

const formSchema = z.object({
  items: z.array(itemSchema),
});

type FormValues = z.infer<typeof formSchema>;

type BulkTransferToOnBarDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  items: InventoryItem[];
  onBulkTransfer: (itemsToTransfer: { productId: string; quantity: number; pegPrices?: { '30ml': number; '60ml': number } }[]) => Promise<void>;
};

export default function BulkTransferToOnBarDialog({ isOpen, onOpenChange, items, onBulkTransfer }: BulkTransferToOnBarDialogProps) {
  const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { items: [] },
  });

  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (items) {
      const formItems: BulkTransferOnBarItem[] = items
        .filter(item => item.category !== 'IML') // Filter out IML items
        .map(item => ({
            productId: item.id,
            brand: item.brand,
            size: item.size,
            category: item.category,
            stockInGodown: item.stockInGodown,
            price: item.price,
            quantity: 0,
            pegPrice30ml: undefined,
            pegPrice60ml: undefined,
        }));
      replace(formItems);
    }
  }, [items, replace]);

  const onSubmit = (data: FormValues) => {
    const itemsToTransfer = data.items
      .filter(item => item.quantity > 0)
      .map(({ productId, quantity, pegPrice30ml, pegPrice60ml }) => ({
        productId,
        quantity,
        pegPrices: pegPrice30ml ? { '30ml': pegPrice30ml, '60ml': pegPrice60ml || pegPrice30ml * 2 } : undefined,
      }));
    
    if (itemsToTransfer.length > 0) {
      onBulkTransfer(itemsToTransfer);
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bulk Transfer to On-Bar</DialogTitle>
          <DialogDescription>
            Enter quantities and peg prices for items to transfer to the On-Bar inventory.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] md:h-[50vh] pr-4">
              {isMobile ? (
                 <div className="space-y-4">
                    {fields.map((field, index) => {
                       const isLiquor = LIQUOR_CATEGORIES.includes(field.category);
                        return (
                             <Card key={field.id} className="p-4 space-y-4">
                                <div>
                                    <h3 className="font-bold">{field.brand}</h3>
                                    <p className="text-sm text-muted-foreground">{field.size} &bull; Available: {field.stockInGodown}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                     <FormField
                                      control={form.control}
                                      name={`items.${index}.quantity`}
                                      render={({ field: qtyField }) => (
                                        <FormItem>
                                          <FormLabel>Quantity</FormLabel>
                                          <FormControl><Input type="number" placeholder="0" {...qtyField} className="h-9"/></FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    {!isLiquor && (
                                        <div className="flex flex-col justify-end">
                                            <p className="text-sm font-medium text-muted-foreground">Price/Unit: ₹{field.price}</p>
                                        </div>
                                    )}
                                </div>
                                {isLiquor && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.pegPrice30ml`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>30ml Price</FormLabel>
                                                    <div className="relative">
                                                      <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                                      <FormControl><Input type="number" placeholder="30ml Price" {...field} className="h-9 pl-6" /></FormControl>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                         <FormField
                                            control={form.control}
                                            name={`items.${index}.pegPrice60ml`}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>60ml Price</FormLabel>
                                                    <div className="relative">
                                                      <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                                      <FormControl><Input type="number" placeholder="Auto x2" {...field} className="h-9 pl-6" /></FormControl>
                                                    </div>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                             </Card>
                        )
                    })}
                 </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Brand</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead className="w-28">Quantity</TableHead>
                      <TableHead className="w-32">30ml Price</TableHead>
                      <TableHead className="w-32">60ml Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const isLiquor = LIQUOR_CATEGORIES.includes(field.category);
                      return (
                        <TableRow key={field.id}>
                          <TableCell className="font-medium">{field.brand} <span className="text-muted-foreground">({field.size})</span></TableCell>
                          <TableCell>{field.stockInGodown}</TableCell>
                          <TableCell>
                             <FormField
                                control={form.control}
                                name={`items.${index}.quantity`}
                                render={({ field: qtyField }) => (
                                  <FormItem><FormControl><Input type="number" placeholder="0" {...qtyField} className="h-8"/></FormControl><FormMessage /></FormItem>
                                )}
                              />
                          </TableCell>
                          <TableCell>
                            {isLiquor ? (
                               <FormField
                                  control={form.control}
                                  name={`items.${index}.pegPrice30ml`}
                                  render={({ field: priceField }) => (
                                    <FormItem>
                                       <div className="relative"><IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" /><FormControl><Input type="number" placeholder="e.g., 100" {...priceField} className="h-8 pl-6"/></FormControl></div>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                            ) : (
                               <span className="text-muted-foreground flex items-center justify-center">₹{field.price}/unit</span>
                            )}
                          </TableCell>
                           <TableCell>
                            {isLiquor ? (
                               <FormField
                                  control={form.control}
                                  name={`items.${index}.pegPrice60ml`}
                                  render={({ field: priceField }) => (
                                    <FormItem>
                                        <div className="relative"><IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" /><FormControl><Input type="number" placeholder="Auto x2" {...priceField} className="h-8 pl-6"/></FormControl></div>
                                        <FormMessage />
                                    </FormItem>
                                  )}
                                />
                            ) : (
                                <span className="text-muted-foreground text-center">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
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

    