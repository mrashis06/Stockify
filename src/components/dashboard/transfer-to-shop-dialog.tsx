

"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { IndianRupee, Barcode, HelpCircle, Scan, CheckCircle, Info } from 'lucide-react';
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
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

type TransferToShopDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  item: GodownItem; 
  onTransfer: (productId: string, quantity: number, barcodeId: string, price?: number) => void;
};

// Define stages for the dialog
type DialogStage = 'scan' | 'details' | 'confirm';

export default function TransferToShopDialog({ isOpen, onOpenChange, item, onTransfer }: TransferToShopDialogProps) {
  const { toast } = useToast();
  const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
  
  const [stage, setStage] = useState<DialogStage>('scan');
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(false);
  const [existingPrice, setExistingPrice] = useState<number | null>(null);
  const [isScannerActive, setIsScannerActive] = useState(false);


  const formSchema = z.object({
    quantity: z.coerce.number().int()
      .min(1, 'Quantity must be at least 1')
      .max(item.quantity, `Cannot transfer more than available stock (${item.quantity})`),
    price: isNewProduct 
      ? z.coerce.number().min(0.01, 'Price must be a positive number.')
      : z.coerce.number().optional(),
  });

  type TransferFormValues = z.infer<typeof formSchema>;
  
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quantity: '' as any,
      price: '' as any,
    },
  });

  const resetState = () => {
      setStage('scan');
      setScannedBarcode(null);
      setIsNewProduct(false);
      setExistingPrice(null);
      setIsScannerActive(false);
      form.reset();
  };

  useEffect(() => {
    if (isOpen) {
      resetState();
    }
  }, [isOpen]);

  const handleScanSuccess = async (decodedText: string) => {
    setIsScannerActive(false);
    setScannedBarcode(decodedText);

    try {
        const inventoryQuery = query(collection(db, 'inventory'), where('barcodeId', '==', decodedText), limit(1));
        const inventorySnap = await getDocs(inventoryQuery);
        
        if (inventorySnap.empty) {
            setIsNewProduct(true);
            form.reset({ quantity: '' as any, price: '' as any });
        } else {
            const existingItem = inventorySnap.docs[0].data() as InventoryItem;
            setIsNewProduct(false);
            setExistingPrice(existingItem.price);
            form.reset({ quantity: '' as any, price: existingItem.price });
        }
        setStage('details');
    } catch (error) {
        toast({ title: 'Database Error', description: 'Could not verify barcode. Please try again.', variant: 'destructive' });
        resetState();
    }
  };
  
  const onSubmit = (data: TransferFormValues) => {
    if (!scannedBarcode) return;
    onTransfer(item.productId, data.quantity, scannedBarcode, data.price);
  };

  const renderContent = () => {
      if (isScannerActive) {
           return (
             <div className="fixed inset-0 bg-background z-50 p-4 flex flex-col items-center justify-center">
                <h2 className="text-lg font-bold mb-2">Scan Barcode for {item.brand}</h2>
                <div className="w-full max-w-sm">
                   <SharedScanner 
                    onScanSuccess={handleScanSuccess}
                    isPaused={!isScannerActive}
                   />
                </div>
                <Button type="button" variant="secondary" onClick={() => setIsScannerActive(false)} className="mt-4">
                    Cancel Scan
                </Button>
            </div>
           )
      }

      switch (stage) {
          case 'scan':
              return (
                  <div className="text-center space-y-4 py-8">
                     <p>Scan the product barcode to continue.</p>
                     <Button type="button" size="lg" onClick={() => setIsScannerActive(true)} disabled={!isMobile}>
                        <Barcode className="mr-2 h-5 w-5" /> Scan Product
                     </Button>
                     {!isMobile && (
                        <Alert variant="default" className="mt-2 text-left">
                            <HelpCircle className="h-4 w-4" />
                            <AlertTitle>Desktop Mode</AlertTitle>
                            <AlertDescription>Scanner is available on mobile devices. Please open on your phone or enter the barcode manually in the next step.</AlertDescription>
                        </Alert>
                     )}
                     <Button type="button" variant="link" onClick={() => setStage('details')}>
                        Enter Barcode Manually
                     </Button>
                  </div>
              );

          case 'details':
              return (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                      <Alert variant={isNewProduct ? 'destructive' : 'default'}>
                        {isNewProduct ? <Info className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        <AlertTitle>{isNewProduct ? 'New Product Detected' : 'Existing Product Found'}</AlertTitle>
                        <AlertDescription>
                            {isNewProduct 
                                ? 'This barcode is new. Please set the selling price.' 
                                : `This product is already in your inventory. Price: ₹${existingPrice}`
                            }
                        </AlertDescription>
                      </Alert>

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
                              <Input type="number" placeholder="Enter quantity" {...field} autoFocus />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                         <Button type="button" variant="ghost" onClick={resetState}>Back</Button>
                         <Button type="submit" className="bg-green-600 hover:bg-green-700">Transfer</Button>
                      </DialogFooter>
                    </form>
                  </Form>
              );
      }
  }


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer to Shop</DialogTitle>
           <DialogDescription>
             Transferring: {item.brand} ({item.size})
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
