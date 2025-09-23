
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useFormContext, FormProvider } from 'react-hook-form';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InventoryItem } from '@/hooks/use-inventory';
import type { OnBarItem } from '@/hooks/use-onbar-inventory';
import { useOnBarInventory } from '@/hooks/use-onbar-inventory';

// Schema for tracking from inventory
const trackedSchema = z.object({
  inventoryItemId: z.string().min(1, 'Please select an item from your inventory.'),
});
type TrackedFormValues = z.infer<typeof trackedSchema>;

// Schema for manual entry
const manualSchema = z.object({
    brand: z.string().min(1, 'Brand name is required.'),
    size: z.string().min(1, 'Size is required (e.g., 750ml).'),
    totalVolume: z.coerce.number().int().min(1, 'Volume must be a positive number.'),
});
type ManualFormValues = z.infer<typeof manualSchema>;


type AddOnBarItemDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  shopInventory: InventoryItem[];
  onBarInventory: OnBarItem[];
  onAddItem: (inventoryItemId: string, volume: number) => void; // This might need adjustment
};

function TrackedForm({ shopInventory, onBarInventory, onOpenChange }: { shopInventory: InventoryItem[], onBarInventory: OnBarItem[], onOpenChange: (isOpen: boolean) => void }) {
    const form = useFormContext<TrackedFormValues>();
    const [search, setSearch] = useState('');
    const { addOnBarItem } = useOnBarInventory();
    
    const availableInventory = useMemo(() => {
        const onBarIds = new Set(onBarInventory.map(item => item.inventoryId));
        return shopInventory
        .filter(item => !onBarIds.has(item.id))
        .filter(item => (item.closing ?? 0) > 0)
        .filter(item => item.brand.toLowerCase().includes(search.toLowerCase()));
    }, [shopInventory, onBarInventory, search]);

    const onSubmit = async (data: TrackedFormValues) => {
        const selectedItem = shopInventory.find(item => item.id === data.inventoryItemId);
        if (!selectedItem) {
            console.error("Selected item not found in inventory");
            return;
        }
        
        const volumeMatch = selectedItem.size.match(/(\d+)/);
        const volume = volumeMatch ? parseInt(volumeMatch[1], 10) : 0;
        
        if (volume <= 0) {
            alert("Could not determine volume from item size. Cannot add to bar.");
            return;
        }

        try {
            await addOnBarItem(selectedItem.id, volume);
            onOpenChange(false);
        } catch(error) {
            console.error(error);
        }
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <Button type="button" variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">Open Bottle</Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

function ManualForm({ onOpenChange }: { onOpenChange: (isOpen: boolean) => void }) {
    const form = useFormContext<ManualFormValues>();
    const { addOnBarItemManual } = useOnBarInventory();

    const onSubmit = async (data: ManualFormValues) => {
        try {
            await addOnBarItemManual(data);
            onOpenChange(false);
        } catch (error) {
            console.error(error);
        }
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                 <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Brand Name</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Macallan 18" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="size"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Size</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., 750ml" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="totalVolume"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Total Volume (ml)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 750" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" className="bg-green-600 hover:bg-green-700">Add Manually</Button>
                </DialogFooter>
            </form>
        </Form>
    );
}


export default function AddOnBarItemDialog({ isOpen, onOpenChange, shopInventory, onBarInventory, onAddItem }: AddOnBarItemDialogProps) {
  const trackedForm = useForm<TrackedFormValues>({ resolver: zodResolver(trackedSchema) });
  const manualForm = useForm<ManualFormValues>({ resolver: zodResolver(manualSchema), defaultValues: { brand: '', size: '', totalVolume: 750 } });
  
  useEffect(() => {
    if (!isOpen) {
      trackedForm.reset();
      manualForm.reset();
    }
  }, [isOpen, trackedForm, manualForm]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open a Bottle</DialogTitle>
          <DialogDescription>
            Choose to track an item from your main inventory or add one manually.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="tracked" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="tracked">From Inventory</TabsTrigger>
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            </TabsList>
            <TabsContent value="tracked" className="py-4">
                 <FormProvider {...trackedForm}>
                    <TrackedForm shopInventory={shopInventory} onBarInventory={onBarInventory} onOpenChange={onOpenChange} />
                 </FormProvider>
            </TabsContent>
            <TabsContent value="manual" className="py-4">
                 <FormProvider {...manualForm}>
                    <ManualForm onOpenChange={onOpenChange} />
                 </FormProvider>
            </TabsContent>
        </Tabs>
        
      </DialogContent>
    </Dialog>
  );
}
