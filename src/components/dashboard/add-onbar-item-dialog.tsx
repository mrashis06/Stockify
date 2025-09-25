
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

// Schema for manual entry
const manualSchema = z.object({
    brand: z.string().min(1, 'Brand name is required.'),
    size: z.string().min(1, 'Size is required (e.g., 650ml).'),
    category: z.string().min(1, 'Category is required'),
    totalVolume: z.coerce.number().int().min(1, 'Volume must be a positive number.'),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
    price: z.coerce.number().min(0, "Price must be non-negative").optional(),
});
type ManualFormValues = z.infer<typeof manualSchema>;


type AddOnBarItemDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const categories = ['Whiskey', 'Rum', 'Beer', 'Vodka', 'Wine', 'Gin', 'Tequila', 'IML'];


function ManualForm({ onOpenChange }: { onOpenChange: (isOpen: boolean) => void }) {
    const form = useFormContext<ManualFormValues>();
    const { addOnBarItemManual } = useOnBarInventory();

    const category = form.watch('category');
    const isBeer = category === 'Beer';

    useEffect(() => {
        const subscription = form.watch((value, { name, type }) => {
            if (name === 'category' && value.category === 'Beer') {
                const sizeMl = parseInt(value.size?.match(/(\d+)/)?.[0] || '0', 10);
                if (sizeMl > 0) {
                    form.setValue('totalVolume', sizeMl, { shouldValidate: true });
                }
            } else if (name === 'size' && form.getValues('category') === 'Beer') {
                const sizeMl = parseInt(value.size?.match(/(\d+)/)?.[0] || '0', 10);
                 if (sizeMl > 0) {
                    form.setValue('totalVolume', sizeMl, { shouldValidate: true });
                }
            }
        });
        return () => subscription.unsubscribe();
    }, [form]);


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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
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
                        <FormLabel>Size (ml)</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., 750ml or 650" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {categories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                
                {isBeer && (
                    <FormField
                        control={form.control}
                        name="quantity"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Quantity of Units</FormLabel>
                            <FormControl>
                                <Input type="number" min="1" placeholder="Enter quantity" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Sale Price per Unit (₹)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 250" {...field} />
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
                        <FormLabel>Volume per unit (ml)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 750" {...field} disabled={isBeer} />
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


export default function AddOnBarItemDialog({ isOpen, onOpenChange }: AddOnBarItemDialogProps) {
  const manualForm = useForm<ManualFormValues>({ resolver: zodResolver(manualSchema), defaultValues: { brand: '', size: '', category: '', totalVolume: 750, quantity: undefined, price: 0 } });
  
  useEffect(() => {
    if (!isOpen) {
      manualForm.reset({ brand: '', size: '', category: '', totalVolume: 750, quantity: undefined, price: 0 });
    }
  }, [isOpen, manualForm]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open a Bottle</DialogTitle>
          <DialogDescription>
            Manually enter the details of the bottle you are opening.
          </DialogDescription>
        </DialogHeader>
        <FormProvider {...manualForm}>
            <ManualForm onOpenChange={onOpenChange} />
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
