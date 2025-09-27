
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Search, IndianRupee } from 'lucide-react';

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
import { ScrollArea } from '@/components/ui/scroll-area';
import type { InventoryItem } from '@/hooks/use-inventory';


const formSchema = z.object({
  inventoryId: z.string().min(1, 'Please select a product.'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.'),
  pegPrice30ml: z.coerce.number().optional(),
  pegPrice60ml: z.coerce.number().optional(),
}).refine(data => {
    // This validation runs if a product is selected and it is NOT a beer.
    const productIsLiquor = data.inventoryId && !data.inventoryId.toLowerCase().includes('beer');
    if (productIsLiquor) {
        return data.pegPrice30ml !== undefined && data.pegPrice30ml > 0;
    }
    return true;
}, {
    message: "Price for 30ml peg is required.",
    path: ["pegPrice30ml"],
});

type AddOnBarItemFormValues = z.infer<typeof formSchema>;

type AddOnBarItemDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddItem: (inventoryId: string, volume: number, quantity: number, pegPrices?: { '30ml': number, '60ml': number }) => Promise<void>;
  shopInventory: InventoryItem[];
};

const allowedCategories = ['Whiskey', 'Rum', 'Vodka', 'Beer', 'Wine'];

export default function AddOnBarItemDialog({ isOpen, onOpenChange, onAddItem, shopInventory }: AddOnBarItemDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const form = useForm<AddOnBarItemFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inventoryId: '',
      quantity: 1,
      pegPrice30ml: '' as any,
      pegPrice60ml: '' as any,
    },
  });
  
  const baseFilteredInventory = useMemo(() => {
    return shopInventory.filter(item => item.category && allowedCategories.includes(item.category));
  }, [shopInventory]);

  const filteredInventory = useMemo(() => {
    if (!searchTerm) return baseFilteredInventory;
    return baseFilteredInventory.filter(item =>
        item.brand.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [baseFilteredInventory, searchTerm]);

  const selectedProductId = form.watch('inventoryId');
  const selectedProduct = useMemo(() => shopInventory.find(item => item.id === selectedProductId), [shopInventory, selectedProductId]);
  const isBeer = selectedProduct?.category === 'Beer';

  const onSubmit = async (data: AddOnBarItemFormValues) => {
    try {
        const item = shopInventory.find(i => i.id === data.inventoryId);
        if (!item) throw new Error("Selected item not found.");
        
        const volumeMatch = item.size.match(/(\d+)/);
        const volume = volumeMatch ? parseInt(volumeMatch[0], 10) : 0;
        
        const pegPrices = data.pegPrice30ml ? {
            '30ml': data.pegPrice30ml,
            '60ml': data.pegPrice60ml || data.pegPrice30ml * 2, // Default 60ml if not provided
        } : undefined;

        await onAddItem(data.inventoryId, volume, data.quantity, pegPrices);
        onOpenChange(false);
    } catch(error) {
        console.error("Failed to add item to On-Bar", error);
        const errorMessage = (error as Error).message || 'An unknown error occurred.';
        form.setError("inventoryId", { type: "manual", message: errorMessage });
    }
  };
  
  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setSearchTerm('');
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open a Bottle</DialogTitle>
          <DialogDescription>
             Select an item from your shop inventory to add it to the on-bar service area. This will not affect your off-counter stock.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="Search for Whiskey, Rum, Vodka..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                  />
              </div>
              <FormField
                  control={form.control}
                  name="inventoryId"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>Product</FormLabel>
                          <ScrollArea className="h-48 border rounded-md">
                              {filteredInventory.length > 0 ? (
                                  filteredInventory.map(item => (
                                      <div key={item.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                                          <div>
                                              <p className="font-semibold">{item.brand}</p>
                                              <p className="text-sm text-muted-foreground">{item.size} &bull; {item.category}</p>
                                          </div>
                                          <Button 
                                              size="sm" 
                                              type="button"
                                              variant={field.value === item.id ? 'default' : 'outline'}
                                              onClick={() => field.onChange(item.id)}>
                                                  {field.value === item.id ? 'Selected' : 'Select'}
                                          </Button>
                                      </div>
                                  ))
                              ) : (
                                  <div className="text-center p-8 text-muted-foreground">
                                      No products found.
                                  </div>
                              )}
                          </ScrollArea>
                          <FormMessage />
                      </FormItem>
                  )}
              />
              
              {selectedProduct && (
                isBeer ? (
                  <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Quantity of Units</FormLabel>
                              <FormControl>
                                  <Input type="number" min="1" placeholder="Number of beer bottles" {...field} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                  />
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="pegPrice30ml" render={({ field }) => (
                             <FormItem>
                                <FormLabel>30ml Peg Price</FormLabel>
                                <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <FormControl><Input type="number" placeholder="e.g. 100" {...field} defaultValue={field.value || ''} className="pl-8" /></FormControl>
                                </div>
                                <FormMessage />
                             </FormItem>
                        )} />
                        <FormField control={form.control} name="pegPrice60ml" render={({ field }) => (
                             <FormItem>
                                <FormLabel>60ml Peg Price</FormLabel>
                                 <div className="relative">
                                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <FormControl><Input type="number" placeholder="e.g. 200" {...field} defaultValue={field.value || ''} className="pl-8" /></FormControl>
                                 </div>
                                <FormMessage />
                             </FormItem>
                        )} />
                    </div>
                )
              )}

               <DialogFooter>
                  <DialogClose asChild>
                      <Button type="button" variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700">Open Bottle</Button>
              </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
