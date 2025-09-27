
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { useRouter } from 'next/navigation';
import { Camera, Barcode, HelpCircle, IndianRupee } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';
import { collection, query, where, getDocs, or } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useInventory, InventoryItem } from '@/hooks/use-inventory';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePageLoading } from '@/hooks/use-loading';
import { useAuth } from '@/hooks/use-auth';


export default function SalesPage() {
    const { inventory, recordSale } = useInventory();
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
    usePageLoading(false);

    const [isScannerActive, setIsScannerActive] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [saleQuantity, setSaleQuantity] = useState<number | ''>('');
    const [editedPrice, setEditedPrice] = useState<number | null>(null);
    
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const scannerStateRef = useRef<'idle' | 'starting' | 'running' | 'stopping'>('idle');
    const processingRef = useRef<boolean>(false);

    const stopScanner = useCallback(async () => {
        if (scannerStateRef.current !== 'running' || !html5QrCodeRef.current) {
            return;
        }

        scannerStateRef.current = 'stopping';
        try {
            const scanner = html5QrCodeRef.current;
            if (scanner && scanner.getState() === Html5QrcodeScannerState.SCANNING) {
                await scanner.stop();
            }
        } catch (err: any) {
            if (!err.message.includes("Cannot transition to a new state, already under transition")) {
                console.error("Failed to stop scanner gracefully.", err);
            }
        } finally {
            scannerStateRef.current = 'idle';
            setIsScannerActive(false);
        }
    }, []);


    const startScanner = useCallback(async () => {
        if (!isMobile || scannerStateRef.current === 'running' || scannerStateRef.current === 'starting') {
            return;
        }
        scannerStateRef.current = 'starting';

        resetScanState();

        if (!html5QrCodeRef.current) {
            html5QrCodeRef.current = new Html5Qrcode("barcode-scanner-region", { verbose: false });
        }

        try {
            await html5QrCodeRef.current.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    if (processingRef.current) return;
                    processingRef.current = true;
                    
                    setScanResult(decodedText);
                    handleScanSuccess(decodedText);
                },
                (errorMessage) => { /* ignore */ }
            );
            scannerStateRef.current = 'running';
            setIsScannerActive(true);
        } catch (err: any) {
             if (err.message && err.message.includes("Cannot transition to a new state, already under transition")) {
                scannerStateRef.current = 'running'; // Assume it is running
                return;
            }
            console.error("Error starting scanner:", err);
            let errorMessage = "Could not start camera. Please check permissions and refresh.";
            if (err.name === 'NotAllowedError') {
                 errorMessage = "Camera access was denied. Please go to your browser settings and allow camera access for this site.";
            }
            setScanError(errorMessage);
            scannerStateRef.current = 'idle';
        }
    }, [isMobile]);

    useEffect(() => {
        if(isMobile) startScanner();

        return () => {
            stopScanner();
        };
    }, [isMobile, startScanner, stopScanner]);

    const handleScanSuccess = async (decodedText: string) => {
        try {
            const inventoryRef = collection(db, "inventory");
            const q = query(inventoryRef, or(
                where("barcodeId", "==", decodedText),
                where("qrCodeId", "==", decodedText)
            ));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const itemId = querySnapshot.docs[0].id;
                const itemFromHook = inventory.find(i => i.id === itemId);
                if (itemFromHook) {
                    setScannedItem(itemFromHook);
                    setEditedPrice(itemFromHook.price);
                } else {
                    // Item exists in master but not in daily-loaded inventory. This can happen for newly added items.
                    const masterData = querySnapshot.docs[0].data();
                    const fallbackItem = { id: itemId, ...masterData, added: 0, sales: 0, prevStock: masterData.prevStock || 0 } as InventoryItem;
                    setScannedItem(fallbackItem);
                    setEditedPrice(fallbackItem.price);
                }
            } else {
                toast({ title: 'Product Not Mapped', description: 'Redirecting to mapping page...', variant: 'destructive' });
                router.push(`/dashboard/map-barcode?code=${decodedText}`);
            }
        } catch (error) {
            console.error("Error fetching product by barcode:", error);
            setScanError("An error occurred while fetching the product.");
        } finally {
            // Keep processingRef true until user confirms or cancels sale
        }
    };
    
    const handleSale = async () => {
        if (!scannedItem || editedPrice === null || !user) return;
        
        const quantityNum = Number(saleQuantity);
        if (saleQuantity === '' || isNaN(quantityNum)) {
            toast({ title: 'Invalid Quantity', description: 'Please enter a quantity.', variant: 'destructive' });
            return;
        }

        if (quantityNum <= 0 || !Number.isInteger(quantityNum)) {
            toast({ title: 'Invalid Quantity', description: 'Please enter a valid whole number greater than zero.', variant: 'destructive' });
            return;
        }

        const opening = (scannedItem.prevStock || 0) + (scannedItem.added || 0);
        const availableStock = opening - (scannedItem.sales || 0);

        if (quantityNum > availableStock) {
            toast({ title: 'Error', description: `Cannot sell more than available stock (${availableStock}).`, variant: 'destructive' });
            return;
        }
        
        try {
            await recordSale(scannedItem.id, quantityNum, editedPrice, user.uid);

            toast({ title: 'Sale Recorded', description: `Sold ${quantityNum} of ${scannedItem.brand} at ₹${editedPrice} each.` });
            resetScanState();
        } catch (error) {
            console.error("Error processing sale:", error);
            const errorMessage = (error as Error).message || 'Failed to process sale.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        } finally {
             processingRef.current = false;
        }
    };

    const resetScanState = () => {
        setScanResult(null);
        setScannedItem(null);
        setScanError(null);
        setSaleQuantity('');
        setEditedPrice(null);
        processingRef.current = false;
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
                    {isMobile ? (
                        <>
                            <div id="barcode-scanner-region" className="w-full aspect-video bg-black rounded-md overflow-hidden" />
                             {!isScannerActive && !scanError && (
                                <div className="text-center p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-4">
                                     <p className="text-muted-foreground">Press the button to start scanning.</p>
                                     <Button onClick={startScanner}>
                                        <Camera className="mr-2" /> Start Scanner
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <Alert>
                            <HelpCircle className="h-4 w-4" />
                            <AlertTitle>Desktop Mode</AlertTitle>
                            <AlertDescription>
                                Barcode scanning is optimized for mobile devices. Please use your phone to access this feature.
                            </AlertDescription>
                        </Alert>
                    )}

                    {scanError && (
                        <Alert variant="destructive">
                            <AlertDescription>{scanError}</AlertDescription>
                            <Button onClick={resetScanState} variant="outline" className="w-full mt-4">Scan Again</Button>
                        </Alert>
                    )}

                    {scannedItem && (
                        <Card className="bg-muted/50">
                            <CardHeader>
                                <CardTitle>{scannedItem.brand}</CardTitle>
                                <CardDescription>{scannedItem.size} &bull; {scannedItem.category}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
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
                                        onFocus={(e) => e.target.select()}
                                    />
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <Button onClick={handleSale} className="flex-1 bg-green-600 hover:bg-green-700">Confirm Sale</Button>
                                    <Button onClick={resetScanState} variant="outline" className="flex-1">Cancel</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
