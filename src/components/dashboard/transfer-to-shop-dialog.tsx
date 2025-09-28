

"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { IndianRupee, Barcode, HelpCircle } from 'lucide-react';
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
import type { GodownItem } from '@/hooks/use-godown-inventory';
import SharedScanner from './shared-scanner';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { useMediaQuery } from 'react-responsive';
import type { InventoryItem } from '@/hooks/use-inventory';


type TransferToShopDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: GodownItem; // Represents the grouped item, where id is productId and quantity is totalQuantity
  shopItem?: InventoryItem | null; // The corresponding item from shop inventory, if it exists
  onTransfer: (productId: string, quantity: number, price?: number, barcodeId?: string) => void;
};

export default function TransferToShopDialog({ isOpen, onOpenChange, item, shopItem, onTransfer }: TransferToShopDialogProps) {
  const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
  const [isScannerPaused, setIsScannerPaused] = useState(true); // Paused by default

  const isNewProduct = !shopItem;
  const requiresBarcode = isNewProduct || (shopItem && !shopItem.barcodeId);
  
  const formSchema = z.object({
    quantity: z.coerce.number().int()
      .min(1, 'Quantity must be at least 1')
      .max(item.quantity, `Cannot transfer more than available stock (${item.quantity})`),
    price: isNewProduct 
      ? z.coerce.number().min(0, 'Price must be a positive number.')
      : z.coerce.number().optional(),
    barcodeId: requiresBarcode ? z.string().min(1, 'Barcode is required for new products.') : z.string().optional(),
  });

  type TransferFormValues = z.infer<typeof formSchema>;
  
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: '' as any,
      price: shopItem?.price ?? ('' as any),
      barcodeId: shopItem?.barcodeId ?? '',
    },
  });

  const handleScanSuccess = (decodedText: string) => {
    form.setValue('barcodeId', decodedText);
    form.clearErrors('barcodeId');
    setIsScannerPaused(true);
  };
  
  useEffect(() => {
    if (isOpen) {
      form.reset({
        quantity: '' as any,
        price: shopItem?.price ?? ('' as any),
        barcodeId: shopItem?.barcodeId ?? '',
      });
      setIsScannerPaused(true); // Reset scanner state on open
    }
  }, [isOpen, item, shopItem, form]);


  const onSubmit = (data: TransferFormValues) => {
    onTransfer(item.productId, data.quantity, data.price, data.barcodeId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer to Shop</DialogTitle>
          <DialogDescription>
             {isNewProduct 
                ? "This is a new product. Please scan its barcode and set the price."
                : requiresBarcode
                ? "This product exists but isn't linked to a barcode. Please scan it now."
                : "Move stock from the godown to the main shop inventory."
             }
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm">
            <p><strong>Item:</strong> {item.brand} ({item.size})</p>
            <p><strong>Available in Godown:</strong> {item.quantity} units</p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            
            {requiresBarcode && (
              <FormField
                control={form.control}
                name="barcodeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Barcode</FormLabel>
                    <div className="flex gap-2">
                        <FormControl>
                            <Input placeholder="Scan or enter barcode" {...field} />
                        </FormControl>
                        <Button type="button" variant="outline" size="icon" onClick={() => setIsScannerPaused(false)} disabled={!isMobile}>
                            <Barcode className="h-4 w-4"/>
                        </Button>
                    </div>
                     {!isMobile && (
                        <Alert variant="default" className="mt-2">
                            <HelpCircle className="h-4 w-4" />
                            <AlertTitle>Scanner Disabled</AlertTitle>
                            <AlertDescription>Enable scanner on mobile to scan barcodes directly.</AlertDescription>
                        </Alert>
                    )}
                    {isMobile && !isScannerPaused && (
                         <div className="fixed inset-0 bg-background z-50 p-4 flex flex-col items-center justify-center">
                            <h2 className="text-lg font-bold mb-2">Scan Barcode for {item.brand}</h2>
                            <div className="w-full max-w-sm">
                               <SharedScanner 
                                onScanSuccess={handleScanSuccess}
                                isPaused={isScannerPaused}
                               />
                            </div>
                            <Button type="button" variant="secondary" onClick={() => setIsScannerPaused(true)} className="mt-4">
                                Cancel Scan
                            </Button>
                        </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isNewProduct && (
                 <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Set Product Price (₹)</FormLabel>
                      <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input type="number" placeholder="Enter sale price" {...field} className="pl-10" />
                          </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            )}

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity to Transfer</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter quantity" {...field} autoFocus={!requiresBarcode} />
                  </FormControl>
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
              <Button type="submit" className="bg-green-600 hover:bg-green-700">Transfer</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
