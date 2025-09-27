
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Camera, Barcode, X, HelpCircle, Search, CheckCircle, Info } from 'lucide-react';
import { useMediaQuery } from 'react-responsive';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useInventory, InventoryItem } from '@/hooks/use-inventory';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePageLoading } from '@/hooks/use-loading';

export default function MapBarcodePage() {
    const { inventory, updateBrand } = useInventory();
    const { toast } = useToast();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
    usePageLoading(false); // This page doesn't have a primary data loading state

    const [isScannerActive, setIsScannerActive] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
    const [alreadyMappedItem, setAlreadyMappedItem] = useState<InventoryItem | null>(null);
    
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
                (decodedText) => { // onSuccess
                    if (processingRef.current) return;
                    processingRef.current = true;
                    setScanResult(decodedText);
                    // Do NOT pause here for continuous scanning
                    handleScanSuccess(decodedText);
                },
                (errorMessage) => { /* onFailure, do nothing */ }
            );
            scannerStateRef.current = 'running';
            setIsScannerActive(true);
        } catch (err: any) {
            if (err.message && err.message.includes("Cannot transition to a new state, already under transition")) {
                scannerStateRef.current = 'running'; // Assume it's running
                return;
            }
            console.error("Error starting scanner:", err);
            if (err.name === 'NotAllowedError') {
                 setScanError("Camera access was denied. Please go to your browser settings and allow camera access for this site.");
            } else {
                 setScanError("Could not start camera. Please check permissions and refresh.");
            }
             scannerStateRef.current = 'idle';
             setIsScannerActive(false);
        }
    }, [isMobile]);

    useEffect(() => {
        if(isMobile) {
            startScanner();
        }
        // Cleanup function to stop the scanner when the component unmounts
        return () => {
             stopScanner();
        };
    }, [isMobile, startScanner, stopScanner]);

    const handleScanSuccess = async (decodedText: string) => {
        try {
            const inventoryRef = collection(db, "inventory");
            const q = query(inventoryRef, where("barcodeId", "==", decodedText));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const mappedItem = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as InventoryItem;
                setAlreadyMappedItem(mappedItem);
            } else {
                setIsMappingDialogOpen(true);
            }
        } catch (error) {
            console.error("Error fetching product by barcode:", error);
            setScanError("An error occurred while fetching the product.");
        } finally {
            // Keep processingRef true until the dialog is closed or action is taken
        }
    };

    const handleMapBarcode = async (productId: string) => {
        if (!scanResult) return;

        try {
            await updateBrand(productId, { barcodeId: scanResult });
            const mappedItem = inventory.find(item => item.id === productId);
            toast({ title: 'Success', description: `Barcode mapped to ${mappedItem?.brand} successfully.` });
            resetForNextScan();
        } catch (error) {
            console.error("Error mapping barcode:", error);
            toast({ title: 'Error', description: 'Mapping failed. Please try again.', variant: 'destructive' });
        } finally {
             processingRef.current = false;
        }
    };

    const resetScanState = () => {
        setScanResult(null);
        setScanError(null);
        setAlreadyMappedItem(null);
        setIsMappingDialogOpen(false);
        processingRef.current = false;
    };

    const handleCancelMapping = () => {
        setIsMappingDialogOpen(false);
        processingRef.current = false;
    }

    const resetForNextScan = () => {
        resetScanState();
    };

    return (
        <main className="flex-1 p-4 md:p-8">
            <MapProductDialog
                isOpen={isMappingDialogOpen}
                onOpenChange={setIsMappingDialogOpen}
                barcodeId={scanResult}
                onMap={handleMapBarcode}
                onCancel={handleCancelMapping}
            />

            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Barcode /> Map Product Barcodes
                    </CardTitle>
                    <CardDescription>
                        Scan a product's barcode to link it to an item in your inventory.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isMobile ? (
                        <>
                            <div id="barcode-scanner-region" className="w-full aspect-video bg-black rounded-md overflow-hidden" />
                             {!isScannerActive && !scanError && (
                                <div className="text-center p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-4">
                                     <p className="text-muted-foreground">Press the button to start the camera.</p>
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
                                The barcode scanner is only available on mobile devices.
                            </AlertDescription>
                        </Alert>
                    )}

                    {scanError && (
                        <Alert variant="destructive">
                            <AlertDescription>{scanError}</AlertDescription>
                        </Alert>
                    )}
                    
                    {scanResult && !isMappingDialogOpen && (
                         <Card className="bg-muted/50">
                            <CardHeader>
                                <CardTitle>Last Scan</CardTitle>
                                <CardDescription>Result from the most recent scan.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                               <Alert variant={alreadyMappedItem ? 'default' : 'destructive'}>
                                    {alreadyMappedItem ? <CheckCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                                    <AlertTitle>{alreadyMappedItem ? "Already Mapped" : "New Barcode Detected"}</AlertTitle>
                                    <AlertDescription>
                                        {alreadyMappedItem 
                                            ? `This barcode is already linked to: ${alreadyMappedItem.brand} (${alreadyMappedItem.size}).`
                                            : `This barcode (${scanResult}) is not yet mapped to any product.`
                                        }
                                    </AlertDescription>
                                </Alert>
                                <Button onClick={resetForNextScan} variant="outline" className="w-full">Scan Next Item</Button>
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

function MapProductDialog({ isOpen, onOpenChange, barcodeId, onMap, onCancel }: { isOpen: boolean, onOpenChange: (open: boolean) => void, barcodeId: string | null, onMap: (productId: string) => void, onCancel: () => void }) {
    const { inventory } = useInventory();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredInventory = useMemo(() => {
        if (!searchTerm) return inventory;
        return inventory.filter(item =>
            item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [inventory, searchTerm]);
    
    useEffect(() => {
        if(!isOpen) setSearchTerm('');
    }, [isOpen]);

    const handleSelect = (productId: string) => {
        onMap(productId);
        onOpenChange(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) onCancel(); // Call cancel when dialog is closed
            onOpenChange(open);
        }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Map New Barcode</DialogTitle>
                    <DialogDescription>
                        The barcode <span className="font-mono bg-muted p-1 rounded-sm">{barcodeId}</span> is new. Select the correct product to link it.
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
                                    <Button size="sm" onClick={() => handleSelect(item.id)}>Select</Button>
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
                    <Button onClick={onCancel} variant="outline">Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

    