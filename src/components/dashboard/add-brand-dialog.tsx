
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AddBrandReviewStep from './add-brand-review-step';
import { toast } from '@/hooks/use-toast';

const formSchema = z.object({
  brand: z.string().min(1, 'Brand name is required'),
  size: z.string().min(1, 'Size is required'),
  price: z.coerce.number().min(0, 'Price must be a positive number'),
  category: z.string().min(1, 'Category is required'),
  prevStock: z.coerce.number().int().min(0, 'Initial stock must be a non-negative integer'),
  barcodeId: z.string().optional(),
});

export type AddBrandFormValues = z.infer<typeof formSchema>;

type AddBrandDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddBrand: (data: AddBrandFormValues) => void;
};

const categories = ['Whiskey', 'Rum', 'Beer', 'Vodka', 'Wine', 'Gin', 'Tequila', 'IML'];

export default function AddBrandDialog({ isOpen, onOpenChange, onAddBrand }: AddBrandDialogProps) {
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [formData, setFormData] = useState<AddBrandFormValues | null>(null);
  const [isAddingAnother, setIsAddingAnother] = useState(false);

  const form = useForm<AddBrandFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      brand: '',
      size: '',
      price: 0,
      category: '',
      prevStock: 0,
      barcodeId: '',
    },
  });

  const handleFormSubmit = (data: AddBrandFormValues, addAnother: boolean = false) => {
    onAddBrand(data);
    if(addAnother) {
        toast({
          title: 'Brand Added',
          description: `${data.brand} (${data.size}) has been saved.`,
        });
        form.reset({
          brand: '',
          size: '',
          price: 0,
          category: data.category, // Keep category for next item
          prevStock: 0,
          barcodeId: '',
        });
    } else {
        onOpenChange(false);
    }
  };

  const handleReviewAndSubmit = (data: AddBrandFormValues) => {
    setFormData(data);
    setIsAddingAnother(false); // This path is for single submission
    onAddBrand(data);
    onOpenChange(false);
  }
  
  // Reset state when dialog is closed
  useEffect(() => {
    if (!isOpen) {
      form.reset();
      setStep('form');
      setFormData(null);
      setIsAddingAnother(false);
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{'Add New Brand'}</DialogTitle>
          <DialogDescription>
            {'Enter the details for the new brand.'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleReviewAndSubmit)}>
              <div className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Old Monk" {...field} />
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
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 190" {...field} />
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
                      <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
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
                <FormField
                  control={form.control}
                  name="prevStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Stock</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="flex-col sm:flex-row sm:justify-end gap-2 pt-4">
                 <DialogClose asChild>
                  <Button type="button" variant="secondary" className="w-full sm:w-auto">Cancel</Button>
                </DialogClose>
                 <Button type="button" variant="outline" onClick={form.handleSubmit((data) => handleFormSubmit(data, true))} className="w-full sm:w-auto">
                    Save & Add Another
                 </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">Save & Close</Button>
              </DialogFooter>
            </form>
          </Form>
      </DialogContent>
    </Dialog>
  );
}
