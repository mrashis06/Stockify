
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Search } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { InventoryItem } from '@/hooks/use-inventory';
import type { OnBarItem } from '@/hooks/use-onbar-inventory';
import { useOnBarInventory } from '@/hooks/use-onbar-inventory';

const formSchema = z.object({
  inventoryItemId: z.string().min(1, 'Please select an item from your inventory.'),
});

type AddOnBarItemFormValues = z.infer<typeof formSchema>;

type AddOnBarItemDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  shopInventory: InventoryItem[];
  onBarInventory: OnBarItem[];
  onAddItem: (inventoryItemId: string, volume: number) => void;
};

export default function AddOnBarItemDialog({ isOpen, onOpenChange, shopInventory, onBarInventory, onAddItem }: AddOnBarItemDialogProps) {
  const { addOnBarItem } = useOnBarInventory();
  const [search, setSearch] = useState('');

  const form = useForm<AddOnBarItemFormValues>({
    resolver: zodResolver(formSchema),
  });
  
  const availableInventory = useMemo(() => {
    const onBarIds = new Set(onBarInventory.map(item => item.inventoryId));
    return shopInventory
      .filter(item => !onBarIds.has(item.id)) // Filter out items already on the bar
      .filter(item => (item.closing ?? 0) > 0) // Filter for items with stock
      .filter(item => item.brand.toLowerCase().includes(search.toLowerCase())); // Filter by search
  }, [shopInventory, onBarInventory, search]);

  const onSubmit = async (data: AddOnBarItemFormValues) => {
    const selectedItem = shopInventory.find(item => item.id === data.inventoryItemId);
    if (!selectedItem) {
      console.error("Selected item not found in inventory");
      return;
    }
    
    // Extract volume from size string (e.g., "750ml" -> 750)
    const volumeMatch = selectedItem.size.match(/(\d+)/);
    const volume = volumeMatch ? parseInt(volumeMatch[1], 10) : 0;
    
    if (volume <= 0) {
        alert("Could not determine volume from item size. Cannot add to bar.");
        return;
    }

    try {
      // The hook now handles the entire process
      await addOnBarItem(selectedItem.id, volume);
      onOpenChange(false);
    } catch(error) {
      // Error will be displayed by the toast in the main page
      console.error(error);
    }
  };
  
  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setSearch('');
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Open a Bottle</DialogTitle>
          <DialogDescription>
            Select an item from your shop inventory to move one unit to the "On-Bar" section for tracking peg sales.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
            <FormField
              control={form.control}
              name="inventoryItemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item to Open</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an item with available stock" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <div className="p-2">
                        <div className="relative">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                           <Input 
                                placeholder="Search available brands..."
                                className="pl-10 w-full"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                           />
                        </div>
                      </div>
                      <ScrollArea className="h-48">
                        {availableInventory.length > 0 ? (
                            availableInventory.map(item => (
                                <SelectItem key={item.id} value={item.id}>
                                    {item.brand} ({item.size}) - {item.closing} in stock
                                </SelectItem>
                            ))
                        ) : (
                            <div className="text-center text-sm text-muted-foreground p-4">No available items match your search.</div>
                        )}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
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
              <Button type="submit" className="bg-green-600 hover:bg-green-700">Open Bottle</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

