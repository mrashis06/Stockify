
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useMediaQuery } from 'react-responsive';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useInventory, UnprocessedItem, InventoryItem } from '@/hooks/use-inventory';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Barcode, HelpCircle, Scan, CheckCircle, IndianRupee } from 'lucide-react';
import SharedScanner from '@/components/dashboard/shared-scanner';

type ProcessDeliveryDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    unprocessedItem: UnprocessedItem;
    onProcess: (unprocessedItemId: string, barcode: string, details: { price: number; quantity: number; brand: string; size: string; category: string }) => Promise<void>;
};

const formSchema = z.object({
  price: z.coerce.number().min(0.01, 'Price must be a positive number.'),
});
type FormValues = z.infer<typeof formSchema>;

export default function ProcessDeliveryDialog({ isOpen, onOpenChange, unprocessedItem, onProcess }: ProcessDeliveryDialogProps) {
    const { inventory } = useInventory();
    const { toast } = useToast();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });

    const [isClient, setIsClient] = useState(false);
    const [isScannerPaused, setIsScannerPaused] = useState(false);
    const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
    const [existingProduct, setExistingProduct] = useState<InventoryItem | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { price: '' as any },
    });

    useEffect(() => {
        setIsClient(true);
        if (!isOpen) {
            resetState();
        }
    }, [isOpen]);

    const handleScanSuccess = async (decodedText: string) => {
        if (isScannerPaused) return;
        setIsScannerPaused(true);
        setScannedBarcode(decodedText);
        
        const mappedItem = inventory.find(item => item.barcodeId === decodedText);
        if (mappedItem) {
            setExistingProduct(mappedItem);
            // If the item exists, we can process it right away.
            await onProcess(unprocessedItem.id, decodedText, {
                price: mappedItem.price,
                quantity: unprocessedItem.quantity,
                brand: unprocessedItem.brand,
                size: unprocessedItem.size,
                category: unprocessedItem.category,
            });
            onOpenChange(false);
            toast({ title: 'Stock Updated', description: `${unprocessedItem.quantity} units of ${mappedItem.brand} added to Godown.` });
        }
    };

    const resetState = () => {
        setIsScannerPaused(false);
        setScannedBarcode(null);
        setExistingProduct(null);
        form.reset();
    };
    
    const handleSubmitNewProduct = async (data: FormValues) => {
        if (!scannedBarcode) return;
        await onProcess(unprocessedItem.id, scannedBarcode, {
            price: data.price,
            quantity: unprocessedItem.quantity,
            brand: unprocessedItem.brand,
            size: unprocessedItem.size,
            category: unprocessedItem.category,
        });
        onOpenChange(false);
        toast({ title: 'Product Created', description: `${unprocessedItem.brand} has been added to your inventory.` });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Process New Delivery</DialogTitle>
                    <DialogDescription>
                        Scan the barcode for **{unprocessedItem.brand} ({unprocessedItem.size})** to add it to your inventory.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    {scannedBarcode && !existingProduct ? (
                         <Form {...form}>
                            <form onSubmit={form.handleSubmit(handleSubmitNewProduct)} className="space-y-4">
                                <Alert>
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <AlertTitle>New Barcode Scanned</AlertTitle>
                                    <AlertDescription>
                                        This is a new product. Please set its selling price to continue. Barcode: <span className="font-mono">{scannedBarcode}</span>
                                    </AlertDescription>
                                </Alert>
                                <FormField
                                    control={form.control}
                                    name="price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Selling Price (₹)</FormLabel>
                                            <div className="relative">
                                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <FormControl>
                                                    <Input type="number" placeholder="Enter sale price" {...field} className="pl-10" autoFocus />
                                                </FormControl>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <Button type="button" variant="outline" onClick={resetState}>Rescan</Button>
                                    <Button type="submit">Confirm & Add Product</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    ) : (
                         isClient && isMobile ? (
                            <SharedScanner
                                onScanSuccess={handleScanSuccess}
                                isPaused={isScannerPaused}
                            />
                        ) : (
                            <Alert>
                                <HelpCircle className="h-4 w-4" />
                                <AlertTitle>Mobile Feature</AlertTitle>
                                <AlertDescription>
                                    The barcode scanner is only available on mobile devices.
                                </AlertDescription>
                            </Alert>
                        )
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
