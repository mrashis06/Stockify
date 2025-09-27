
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Camera, Barcode, X, HelpCircle, Search, IndianRupee } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useInventory, InventoryItem } from '@/hooks/use-inventory';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePageLoading } from '@/hooks/use-loading';

export default function SalesPage() {
    const { inventory, updateItemField } = useInventory();
    const { toast } = useToast();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
    usePageLoading(false);

    const [isScannerActive, setIsScannerActive] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [saleQuantity, setSaleQuantity] = useState<number>(1);
    const [editedPrice, setEditedPrice] = useState<number | null>(null);
    
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const scannerRunningRef = useRef<boolean>(false);
    const processingRef = useRef<boolean>(false);

    const stopScanner = useCallback(async () => {
        if (scannerRunningRef.current && html5QrCodeRef.current) {
            try {
                if (html5QrCodeRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
                    await html5QrCodeRef.current.stop();
                }
            } catch (err: any) {
                if (err.name !== 'NotAllowedError' && !err.message.includes("Cannot transition to a new state, already under transition")) {
                    console.error("Failed to stop scanner gracefully.", err);
                }
            } finally {
                scannerRunningRef.current = false;
                setIsScannerActive(false);
            }
        }
    }, []);

    const startScanner = useCallback(async () => {
        if (scannerRunningRef.current) return;
        resetScanState(false); // Don't restart scanner, just clear state

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
                    
                    html5QrCodeRef.current?.pause();
                    setScanResult(decodedText);
                    handleScanSuccess(decodedText);
                },
                (errorMessage) => { /* ignore */ }
            );
            scannerRunningRef.current = true;
            setIsScannerActive(true);
        } catch (err: any) {
            console.error("Error starting scanner:", err);
            if (err.name === 'NotAllowedError') {
                 setScanError("Camera access was denied. Please go to your browser settings and allow camera access for this site.");
            } else {
                 setScanError("Could not start camera. Please check permissions and refresh.");
            }
        }
    }, []);

    useEffect(() => {
        // Automatically start on mobile
        if(isMobile) startScanner();

        return () => {
            stopScanner();
        };
    }, [isMobile, startScanner]);

    const handleScanSuccess = async (decodedText: string) => {
        try {
            const inventoryRef = collection(db, "inventory");
            const q = query(inventoryRef, where("barcodeId", "==", decodedText));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const itemId = querySnapshot.docs[0].id;
                const itemFromHook = inventory.find(i => i.id === itemId);
                if (itemFromHook) {
                    setScannedItem(itemFromHook);
                    setEditedPrice(itemFromHook.price);
                } else {
                    setScanError(`Product with barcode ${decodedText} was found but is not in the current active inventory. Try End of Day process.`);
                }
            } else {
                setScanError(`Product not mapped. Please map it first on the 'Map Barcodes' page.`);
            }
        } catch (error) {
            console.error("Error fetching product by barcode:", error);
            setScanError("An error occurred while fetching the product.");
        } finally {
            processingRef.current = false;
        }
    };
    
    const handleSale = async () => {
        if (!scannedItem || editedPrice === null) return;
        
        const availableStock = Number(scannedItem.closing ?? scannedItem.opening ?? 0);
        if (saleQuantity > availableStock) {
            toast({ title: 'Error', description: `Cannot sell more than available stock (${availableStock}).`, variant: 'destructive' });
            return;
        }
        
        try {
            // If price was edited, update it first
            if (editedPrice !== scannedItem.price) {
                await updateItemField(scannedItem.id, 'price', editedPrice);
            }
            
            // Update sales
            const newSales = (scannedItem.sales || 0) + saleQuantity;
            await updateItemField(scannedItem.id, 'sales', newSales);

            toast({ title: 'Sale Recorded', description: `Sold ${saleQuantity} of ${scannedItem.brand} at ₹${editedPrice} each.` });
            resetScanState(true);
        } catch (error) {
            console.error("Error processing sale:", error);
            const errorMessage = (error as Error).message || 'Failed to process sale.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };

    const resetScanState = (restart: boolean) => {
        setScanResult(null);
        setScannedItem(null);
        setScanError(null);
        setSaleQuantity(1);
        setEditedPrice(null);
        processingRef.current = false;

        if (html5QrCodeRef.current?.isPaused) {
            html5QrCodeRef.current.resume();
        }
        
        if (restart && isMobile) {
            startScanner();
        } else if (!isMobile) {
            stopScanner(); // Stop if on desktop
        }
    };

    const availableStock = scannedItem ? Number(scannedItem.closing ?? scannedItem.opening ?? 0) : 0;

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
                            <AlertTitle>Mobile Feature</AlertTitle>
                            <AlertDescription>
                                The barcode scanner is primarily designed for mobile devices.
                            </AlertDescription>
                        </Alert>
                    )}

                    {scanError && (
                        <Alert variant="destructive">
                            <AlertDescription>{scanError}</AlertDescription>
                            <Button onClick={() => resetScanState(true)} variant="outline" className="w-full mt-4">Scan Again</Button>
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
                                        onChange={(e) => setSaleQuantity(Number(e.target.value))}
                                        min="1"
                                        max={availableStock}
                                        className="max-w-[120px]"
                                    />
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <Button onClick={handleSale} className="flex-1 bg-green-600 hover:bg-green-700">Confirm Sale</Button>
                                    <Button onClick={() => resetScanState(true)} variant="outline" className="flex-1">Scan Another</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

    