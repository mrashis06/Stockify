
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMediaQuery } from 'react-responsive';
import { collection, query, where, getDocs, or, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
import { subDays } from 'date-fns';

export default function SalesPage() {
    const { recordSale, forceRefetch } = useInventory();
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
    const { formatDate } = useDateFormat();

    const [isClient, setIsClient] = useState(false);
    const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
    const [isScannerPaused, setIsScannerPaused] = useState(false);
    const [saleCompleted, setSaleCompleted] = useState(false);
    
    const [saleQuantity, setSaleQuantity] = useState<number | ''>('');
    const [editedPrice, setEditedPrice] = useState<number | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleScanSuccess = async (decodedText: string) => {
        if (isScannerPaused) return;

        setIsScannerPaused(true);

        try {
            const inventoryRef = collection(db, "inventory");
            const q = query(inventoryRef, or(
                where("barcodeId", "==", decodedText),
                where("qrCodeId", "==", decodedText)
            ));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ title: 'Product Not Mapped', description: 'Redirecting to mapping page...', variant: 'destructive' });
                router.push(`/dashboard/map-barcode?code=${decodedText}`);
                return;
            }

            const masterDoc = querySnapshot.docs[0];
            const itemId = masterDoc.id;
            const masterData = masterDoc.data() as Omit<InventoryItem, 'id'>;

            const today = formatDate(new Date(), 'yyyy-MM-dd');
            const yesterday = formatDate(subDays(new Date(), 1), 'yyyy-MM-dd');

            const dailyDocRef = doc(db, 'dailyInventory', today);
            const yesterdayDocRef = doc(db, 'dailyInventory', yesterday);

            const [dailySnap, yesterdaySnap] = await Promise.all([
                getDoc(dailyDocRef),
                getDoc(yesterdayDocRef)
            ]);

            const dailyData = dailySnap.exists() ? dailySnap.data() : {};
            const yesterdayData = yesterdaySnap.exists() ? yesterdaySnap.data() : {};
            
            const itemDailyData = dailyData[itemId];
            
            const prevStock = yesterdayData[itemId]?.closing ?? masterData.prevStock ?? 0;
            const added = itemDailyData?.added ?? 0;
            const sales = itemDailyData?.sales ?? 0;

            const itemData: InventoryItem = {
                ...masterData,
                id: itemId,
                prevStock,
                added,
                sales,
            };
            
            setScannedItem(itemData);
            setEditedPrice(itemData.price);
            setSaleQuantity('');

        } catch (error) {
            console.error("Error fetching product by barcode:", error);
            toast({ title: "Error", description: "An error occurred while fetching the product.", variant: "destructive" });
            resetScanState();
        }
    };
    
    const handleSale = async () => {
        if (!scannedItem || editedPrice === null || !user) return;
        
        const quantityNum = Number(saleQuantity);
        if (saleQuantity === '' || isNaN(quantityNum) || quantityNum <= 0 || !Number.isInteger(quantityNum)) {
            toast({ title: 'Invalid Quantity', description: 'Please enter a valid whole number greater than zero.', variant: 'destructive' });
            return;
        }

        if (quantityNum > availableStock) {
            toast({ title: 'Error', description: `Cannot sell more than available stock (${availableStock}).`, variant: 'destructive' });
            return;
        }
        
        toast({ title: 'Sale Recorded', description: `Sold ${quantityNum} of ${scannedItem.brand} at ₹${editedPrice} each.` });
        setSaleCompleted(true);
        // We don't reset the scanner state here anymore, we wait for user to click "Scan Next"

        try {
            await recordSale(scannedItem.id, quantityNum, editedPrice, user.uid);
            await forceRefetch();
        } catch (error) {
            console.error("Error processing sale:", error);
            const errorMessage = (error as Error).message || 'Failed to process sale.';
            toast({ title: 'Sync Error', description: `Sale recorded locally, but failed to sync. ${errorMessage}`, variant: 'destructive' });
        }
    };

    const resetScanState = () => {
        setScannedItem(null);
        setSaleQuantity('');
        setEditedPrice(null);
        setIsScannerPaused(false);
        setSaleCompleted(false);
    };

    const availableStock = useMemo(() => {
        if (!scannedItem) return 0;
        const opening = (scannedItem.prevStock || 0) + (scannedItem.added || 0);
        return opening - (scannedItem.sales || 0);
    }, [scannedItem]);

    return (
        <main className="flex-1 p-4 md:p-8">
            <h1 className="text-2xl font-bold tracking-tight mb-6">Point of Sale</h1>

            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Barcode /> Barcode Scanner
                    </CardTitle>
                    <CardDescription>
                        Scan a product's barcode to add it to the sale.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isClient && isMobile && !saleCompleted ? (
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
                                            <AlertTitle className="text-green-800 dark:text-green-300">Sale Confirmed</AlertTitle>
                                            <AlertDescription className="text-green-700 dark:text-green-400">
                                                The sale has been successfully recorded.
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
                                        <label htmlFor="quantity" className="font-medium text-sm">Quantity to Sell</label>
                                        <Input
                                            id="quantity"
                                            type="number"
                                            value={saleQuantity}
                                            onChange={(e) => setSaleQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                                            placeholder="Enter quantity"
                                            min="1"
                                            max={availableStock}
                                            className="max-w-[120px]"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-4">
                                        <Button onClick={handleSale} className="flex-1 bg-green-600 hover:bg-green-700">Confirm Sale</Button>
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

  