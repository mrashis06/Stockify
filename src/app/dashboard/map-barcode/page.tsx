

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';
import { useInventory, InventoryItem } from '@/hooks/use-inventory';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Barcode, HelpCircle, Search, CheckCircle, Info, Scan, X } from 'lucide-react';
import SharedScanner from '@/components/dashboard/shared-scanner';

export default function MapBarcodePage() {
    const { inventory, updateBrand, forceRefetch } = useInventory();
    const { toast } = useToast();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });

    const [isClient, setIsClient] = useState(false);
    const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
    const [isScannerPaused, setIsScannerPaused] = useState(false);
    const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
    const [alreadyMappedItem, setAlreadyMappedItem] = useState<InventoryItem | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleScanSuccess = async (decodedText: string) => {
        if (isScannerPaused) return;

        setIsScannerPaused(true);
        setScannedBarcode(decodedText);
        
        const mappedItem = inventory.find(item => item.barcodeId === decodedText);

        if (mappedItem) {
            setAlreadyMappedItem(mappedItem);
        } else {
            setIsMappingDialogOpen(true);
        }
    };

    const handleMapBarcode = async (productId: string) => {
        if (!scannedBarcode) return;

        try {
            // Check if this barcode is already used by another product.
            const existingMapping = inventory.find(item => item.barcodeId === scannedBarcode);
            if(existingMapping) {
                 toast({ title: 'Error', description: `This barcode is already mapped to ${existingMapping.brand}.`, variant: 'destructive' });
                 resetForNextScan();
                 return;
            }

            await updateBrand(productId, { barcodeId: scannedBarcode });
            const mappedItem = inventory.find(item => item.id === productId);
            toast({ title: 'Success', description: `Barcode mapped to ${mappedItem?.brand} successfully.` });
            await forceRefetch(); 
        } catch (error) {
            console.error("Error mapping barcode:", error);
            toast({ title: 'Error', description: 'Mapping failed. Please try again.', variant: 'destructive' });
        } finally {
            resetForNextScan();
        }
    };
    
    const handleCancelMapping = () => {
        setIsMappingDialogOpen(false);
        resetForNextScan();
    };

    const resetForNextScan = () => {
        setScannedBarcode(null);
        setAlreadyMappedItem(null);
        setIsMappingDialogOpen(false);
        setIsScannerPaused(false);
    };

    return (
        <main className="flex-1 p-4 md:p-8">
            <MapProductDialog
                isOpen={isMappingDialogOpen}
                onOpenChange={setIsMappingDialogOpen}
                barcodeId={scannedBarcode}
                onMap={handleMapBarcode}
                onCancel={handleCancelMapping}
            />

            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Barcode /> Map Product Barcodes
                    </CardTitle>
                    <CardDescription>
                        Scan a product's barcode to link it to an item in your inventory. This only needs to be done once per product type.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isClient && isMobile ? (
                        <>
                             <SharedScanner
                                onScanSuccess={handleScanSuccess}
                                isPaused={isScannerPaused}
                             />
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

                    {isScannerPaused && !isMappingDialogOpen && (
                         <Card className="bg-muted/50">
                            <CardHeader>
                                <CardTitle>Scan Result</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                               <Alert variant={alreadyMappedItem ? 'default' : 'destructive'}>
                                    {alreadyMappedItem ? <CheckCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                                    <AlertTitle>{alreadyMappedItem ? "Barcode Already Mapped" : "New Barcode Detected"}</AlertTitle>
                                    <AlertDescription>
                                        {alreadyMappedItem 
                                            ? `This barcode is linked to: ${alreadyMappedItem.brand} (${alreadyMappedItem.size}).`
                                            : `This barcode (${scannedBarcode}) is not yet mapped to any product.`
                                        }
                                    </AlertDescription>
                                </Alert>
                                <Button onClick={resetForNextScan} variant="outline" className="w-full">
                                    <Scan className="mr-2 h-4 w-4" />
                                    Scan Next Item
                                </Button>
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
        // Filter out items that already have a barcode
        const unmappedInventory = inventory.filter(item => !item.barcodeId);
        if (!searchTerm) return unmappedInventory;
        return unmappedInventory.filter(item =>
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
            if (!open) onCancel();
            onOpenChange(open);
        }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Map New Barcode</DialogTitle>
                    <DialogDescription>
                        The barcode <span className="font-mono bg-muted p-1 rounded-sm">{barcodeId}</span> is new. Select an unmapped product to link it to.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search unmapped inventory..."
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
                                No unmapped products found.
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
