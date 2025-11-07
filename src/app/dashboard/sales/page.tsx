

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMediaQuery } from 'react-responsive';
import { useInventory, InventoryItem } from '@/hooks/use-inventory';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { Barcode, HelpCircle, IndianRupee, Scan, X, CheckCircle } from 'lucide-react';
import SharedScanner from '@/components/dashboard/shared-scanner';
import { useDateFormat } from '@/hooks/use-date-format';

const RealTimeClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="font-mono text-sm font-semibold text-muted-foreground">
      {formatTime(time)}
    </div>
  );
};

export default function SalesPage() {
    const { inventory, recordSale } = useInventory();
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
    const { formatDate } = useDateFormat();

    const [isClient, setIsClient] = useState(false);
    const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
    const [isScannerPaused, setIsScannerPaused] = useState(false);
    const [saleCompleted, setSaleCompleted] = useState(false);
    
    const [unitsLeft, setUnitsLeft] = useState<number | ''>('');
    const [editedPrice, setEditedPrice] = useState<number | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleScanSuccess = async (decodedText: string) => {
        if (isScannerPaused) return;
        
        const updatedInventory = useInventory.getState().inventory;
        const itemData = updatedInventory.find(item => item.barcodeId === decodedText);

        if (!itemData) {
            toast({ title: 'Product Not Found', description: 'This barcode is not mapped to any product. Please map it first.', variant: 'destructive' });
            router.push(`/dashboard/map-barcode`);
            return;
        }

        setIsScannerPaused(true);
        setScannedItem(itemData);
        setEditedPrice(itemData.price);
        setUnitsLeft(''); // Start with an empty input
    };
    
    const handleSale = async () => {
        if (!scannedItem || editedPrice === null || !user || unitsLeft === '') return;
        
        const unitsLeftNum = Number(unitsLeft);
        if (isNaN(unitsLeftNum) || unitsLeftNum < 0 || !Number.isInteger(unitsLeftNum)) {
            toast({ title: 'Invalid Input', description: 'Please enter a valid whole number for units left.', variant: 'destructive' });
            return;
        }

        if (unitsLeftNum > availableStock) {
            toast({ title: 'Error', description: `Units left cannot be greater than the available stock of ${availableStock}.`, variant: 'destructive' });
            return;
        }

        const quantitySold = availableStock - unitsLeftNum;

        if (quantitySold <= 0) {
            toast({ title: 'No Sale Recorded', description: 'No change in stock. No sale was recorded.' });
            setSaleCompleted(true); // Show completion state even if no sale
            return;
        }
        
        // Optimistic UI Update: Show success immediately
        setSaleCompleted(true);
        toast({ title: 'Sale Recorded', description: `Sold ${quantitySold} of ${scannedItem.brand} at ₹${editedPrice} each.` });

        // Perform database operations in the background
        recordSale(scannedItem.id, quantitySold, editedPrice, user.uid)
            .catch((error) => {
                // Revert UI on failure
                setSaleCompleted(false); 
                console.error("Error processing sale:", error);
                const errorMessage = (error as Error).message || 'Failed to process sale.';
                toast({ 
                    title: 'Sync Error', 
                    description: `Sale failed to record. Please try again. ${errorMessage}`, 
                    variant: 'destructive',
                    duration: 5000,
                });
            });
    };

    const resetScanState = () => {
        setScannedItem(null);
        setUnitsLeft('');
        setEditedPrice(null);
        setIsScannerPaused(false);
        setSaleCompleted(false);
    };

    const availableStock = useMemo(() => {
        if (!scannedItem) return 0;
        const liveItem = inventory.find(i => i.id === scannedItem.id);
        if (!liveItem) return 0;
        const opening = Number(liveItem.prevStock || 0) + Number(liveItem.added || 0);
        return opening - Number(liveItem.sales || 0);
    }, [scannedItem, inventory]);

    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Point of Sale</h1>
                <div className="flex items-center gap-2">
                    <p className="text-muted-foreground font-bold">{formatDate(new Date(), 'dd/MM/yyyy')}</p>
                    <span className="text-muted-foreground font-bold">&bull;</span>
                    <RealTimeClock />
                </div>
            </div>

            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Barcode /> Barcode Scanner
                    </CardTitle>
                    <CardDescription>
                        Scan a product's barcode to update its stock.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isClient && isMobile ? (
                         <SharedScanner 
                            onScanSuccess={handleScanSuccess}
                            isPaused={isScannerPaused}
                        />
                    ) : (
                        !isMobile && (
                            <Alert>
                                <HelpCircle className="h-4 w-4" />
                                <AlertTitle>Desktop Mode</AlertTitle>
                                <AlertDescription>
                                    Barcode scanning is optimized for mobile devices. Please use your phone to access this feature.
                                </AlertDescription>
                            </Alert>
                        )
                    )}

                    {scannedItem && (
                        <Card className="bg-muted/50">
                            <CardHeader>
                                <CardTitle>{scannedItem.brand}</CardTitle>
                                <CardDescription>{scannedItem.size} &bull; {scannedItem.category}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {saleCompleted ? (
                                    <div className="space-y-4 text-center">
                                        <Alert variant="default" className="bg-green-100 dark:bg-green-900/30 border-green-500/50">
                                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                            <AlertTitle className="text-green-800 dark:text-green-300">Stock Updated</AlertTitle>
                                            <AlertDescription className="text-green-700 dark:text-green-400">
                                                The stock has been successfully updated.
                                            </AlertDescription>
                                        </Alert>
                                        <Button onClick={resetScanState} className="w-full">
                                            <Scan className="mr-2 h-4 w-4" />
                                            Scan Next Item
                                        </Button>
                                    </div>
                                ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="font-medium text-sm">Price</label>
                                            <div className="relative">
                                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="number"
                                                    value={editedPrice ?? ''}
                                                    onChange={(e) => setEditedPrice(Number(e.target.value))}
                                                    className="pl-10"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="font-medium text-sm">Available Stock</label>
                                            <Input
                                                type="text"
                                                value={availableStock}
                                                readOnly
                                                className={`font-bold ${availableStock < 10 ? 'text-destructive' : ''}`}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label htmlFor="unitsLeft" className="font-medium text-sm">Units Left</label>
                                        <Input
                                            id="unitsLeft"
                                            type="number"
                                            value={unitsLeft}
                                            onChange={(e) => setUnitsLeft(e.target.value === '' ? '' : Number(e.target.value))}
                                            placeholder="Enter stock left on shelf"
                                            min="0"
                                            max={availableStock}
                                            className="max-w-[180px]"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-4">
                                        <Button onClick={handleSale} className="flex-1 bg-green-600 hover:bg-green-700">Confirm Update</Button>
                                        <Button onClick={resetScanState} variant="outline" className="flex-1">Cancel</Button>
                                    </div>
                                </>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
