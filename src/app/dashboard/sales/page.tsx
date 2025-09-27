
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeError, Html5QrcodeResult, QrCodeSuccessCallback } from 'html5-qrcode';
import { Camera, Barcode, X, HelpCircle, Search, Edit } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useInventory, InventoryItem } from '@/hooks/use-inventory';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function SalesPage() {
    const { inventory, updateBrand } = useInventory();
    const { toast } = useToast();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });

    const [isScannerActive, setIsScannerActive] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [saleQuantity, setSaleQuantity] = useState<number>(1);
    const [isMapping, setIsMapping] = useState(false);
    
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
                // This error can happen if the scanner is already stopping, it's safe to ignore.
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
        setScanError(null);
        setScannedItem(null);

        if (!html5QrCodeRef.current) {
            html5QrCodeRef.current = new Html5Qrcode("barcode-scanner-region");
        }

        try {
            await html5QrCodeRef.current.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                handleScanSuccess,
                (errorMessage) => { 
                    // This is the error callback, often called for non-decodable frames.
                    // We can largely ignore it to prevent log spam, unless we want to debug.
                }
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
        return () => {
            stopScanner();
        };
    }, [stopScanner]);

    const handleScanSuccess: QrCodeSuccessCallback = useCallback(async (decodedText, decodedResult) => {
        if (processingRef.current) return;
        processingRef.current = true;
        
        stopScanner();
        setScanResult(decodedText);

        try {
            const inventoryRef = collection(db, "inventory");
            const q = query(inventoryRef, where("barcodeId", "==", decodedText));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docData = querySnapshot.docs[0].data() as InventoryItem;
                const itemId = querySnapshot.docs[0].id;
                const itemFromHook = inventory.find(i => i.id === itemId);

                if (itemFromHook) {
                    setScannedItem(itemFromHook);
                } else {
                    // Item found in DB but not in local state, use DB data
                    setScannedItem({ id: itemId, ...docData });
                }
            } else {
                setScanError(`Product with barcode ${decodedText} not found. Please map it to a product.`);
                setIsMapping(true);
            }
        } catch (error) {
            console.error("Error fetching product by barcode:", error);
            setScanError("An error occurred while fetching the product.");
        } finally {
            processingRef.current = false;
        }
    }, [inventory, stopScanner]);

    const handleMapBarcode = async (productId: string) => {
        if (!scanResult) return;

        try {
            await updateBrand(productId, { barcodeId: scanResult });
            const mappedItem = inventory.find(item => item.id === productId);
            if (mappedItem) {
                setScannedItem(mappedItem);
            }
            toast({ title: 'Success', description: `Barcode successfully linked to ${mappedItem?.brand}.` });
            resetScannerState();
        } catch (error) {
            console.error("Error mapping barcode:", error);
            toast({ title: 'Error', description: 'Failed to map barcode.', variant: 'destructive' });
        }
    };

    const handleSale = async () => {
        if (!scannedItem) return;
        
        const availableStock = Number(scannedItem.closing ?? scannedItem.opening ?? 0);
        if (saleQuantity > availableStock) {
            toast({ title: 'Error', description: `Cannot sell more than available stock (${availableStock}).`, variant: 'destructive' });
            return;
        }
        
        // This is where you would call your updateItemField to record the sale
        // For now, we'll just log it and show a toast
        toast({ title: 'Sale Recorded', description: `Sold ${saleQuantity} of ${scannedItem.brand}.` });
        resetScannerState();
    };

    const resetScannerState = () => {
        stopScanner();
        setScanResult(null);
        setScannedItem(null);
        setScanError(null);
        setIsMapping(false);
        setSaleQuantity(1);
    };

    const availableStock = scannedItem ? Number(scannedItem.closing ?? scannedItem.opening ?? 0) : 0;

    return (
        <main className="flex-1 p-4 md:p-8">
            <h1 className="text-2xl font-bold tracking-tight mb-6">Point of Sale</h1>
            
            <MapBarcodeDialog
                isOpen={isMapping}
                onOpenChange={setIsMapping}
                barcodeId={scanResult}
                onMap={handleMapBarcode}
                onCancel={resetScannerState}
            />

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
                            <div id="barcode-scanner-region" className={`w-full aspect-video bg-black rounded-md overflow-hidden ${!isScannerActive ? 'hidden' : ''}`} />
                            
                            {!isScannerActive && (
                                <div className="text-center p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-4">
                                     <p className="text-muted-foreground">Press the button to start scanning.</p>
                                     <Button onClick={startScanner}>
                                        <Camera className="mr-2" /> Start Scanner
                                    </Button>
                                </div>
                            )}
                             {isScannerActive && (
                                <Button onClick={resetScannerState} variant="destructive" className="w-full">
                                    <X className="mr-2" /> Stop Scanner
                                </Button>
                            )}
                        </>
                    ) : (
                        <Alert>
                            <HelpCircle className="h-4 w-4" />
                            <AlertTitle>Mobile Feature</AlertTitle>
                            <AlertDescription>
                                The barcode scanner is only available on mobile devices for the best experience.
                            </AlertDescription>
                        </Alert>
                    )}

                    {scanError && (
                        <Alert variant="destructive">
                            <AlertDescription>{scanError}</AlertDescription>
                        </Alert>
                    )}

                    {scannedItem && (
                        <Card className="bg-muted/50">
                            <CardHeader>
                                <CardTitle>{scannedItem.brand}</CardTitle>
                                <CardDescription>{scannedItem.size} &bull; {scannedItem.category}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Price</span>
                                    <span className="font-bold text-lg">₹{scannedItem.price.toFixed(2)}</span>
                                </div>
                                 <div className="flex items-center justify-between">
                                    <span className="font-medium">Available Stock</span>
                                    <span className={`font-bold text-lg ${availableStock < 10 ? 'text-destructive' : ''}`}>{availableStock}</span>
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="quantity" className="font-medium text-sm">Quantity</label>
                                    <Input
                                        id="quantity"
                                        type="number"
                                        value={saleQuantity}
                                        onChange={(e) => setSaleQuantity(Number(e.target.value))}
                                        min="1"
                                        max={availableStock}
                                        className="max-w-[100px]"
                                    />
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <Button onClick={handleSale} className="flex-1 bg-green-600 hover:bg-green-700">Add to Cart</Button>
                                    <Button onClick={resetScannerState} variant="outline" className="flex-1">Scan Another</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

function MapBarcodeDialog({ isOpen, onOpenChange, barcodeId, onMap, onCancel }: { isOpen: boolean, onOpenChange: (open: boolean) => void, barcodeId: string | null, onMap: (productId: string) => void, onCancel: () => void }) {
    const { inventory } = useInventory();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredInventory = useMemo(() => {
        if (!searchTerm) return inventory;
        return inventory.filter(item =>
            item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [inventory, searchTerm]);
    
    useEffect(() => {
        if(!isOpen) setSearchTerm('');
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Map Barcode</DialogTitle>
                    <DialogDescription>
                        The barcode <span className="font-mono bg-muted p-1 rounded-sm">{barcodeId}</span> is new. Select the correct product from your inventory to link it.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search inventory..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <ScrollArea className="h-64 border rounded-md">
                        {filteredInventory.length > 0 ? (
                            filteredInventory.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                                    <div>
                                        <p className="font-semibold">{item.brand}</p>
                                        <p className="text-sm text-muted-foreground">{item.size} &bull; {item.category}</p>
                                    </div>
                                    <Button size="sm" onClick={() => onMap(item.id)}>Select</Button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center p-8 text-muted-foreground">
                                No products found.
                            </div>
                        )}
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button onClick={onCancel} variant="outline">Cancel</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
