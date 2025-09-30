

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
import { Barcode, HelpCircle, Search, CheckCircle, Info, Scan, Link2 } from 'lucide-react';
import SharedScanner from '@/components/dashboard/shared-scanner';

export default function MapBarcodePage() {
    const { inventory, updateBrand, forceRefetch, linkBarcodeToProduct } = useInventory();
    const { toast } = useToast();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });

    const [isClient, setIsClient] = useState(false);
    const [isMappingDialogOpen, setIsMappingDialogOpen] = useState(false);
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [isScannerPaused, setIsScannerPaused] = useState(false);
    const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
    const [alreadyMappedItem, setAlreadyMappedItem] = useState<InventoryItem | null>(null);
    const [mappingComplete, setMappingComplete] = useState(false);
    const [mappedItemDetails, setMappedItemDetails] = useState<{ brand: string, size: string } | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleScanSuccess = async (decodedText: string) => {
        if (isScannerPaused) return;

        setIsScannerPaused(true);
        setScannedBarcode(decodedText);
        
        await forceRefetch(); // Ensure we have the latest inventory before checking
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
            await updateBrand(productId, { barcodeId: scannedBarcode });
            const newlyMappedItem = inventory.find(item => item.id === productId);
            if (newlyMappedItem) {
                setMappedItemDetails({ brand: newlyMappedItem.brand, size: newlyMappedItem.size });
            }
            setMappingComplete(true);
            toast({
                title: "Mapping Successful",
                description: `Barcode has been linked to ${newlyMappedItem?.brand} (${newlyMappedItem?.size}).`
            });
        } catch (error) {
            console.error("Error mapping barcode:", error);
            toast({ title: 'Error', description: 'Mapping failed. Please try again.', variant: 'destructive' });
        } finally {
            setIsMappingDialogOpen(false);
        }
    };
    
    const handleLinkProduct = async (destinationProductId: string) => {
        if (!alreadyMappedItem) return;

        try {
            await linkBarcodeToProduct(alreadyMappedItem.id, destinationProductId);
            const linkedItem = inventory.find(item => item.id === destinationProductId);
            setMappedItemDetails({ brand: linkedItem?.brand || '', size: linkedItem?.size || '' });
            setMappingComplete(true); // Re-use the same success UI
            toast({
                title: "Link Successful",
                description: `Barcode and stock from "${alreadyMappedItem.brand}" have been moved to "${linkedItem?.brand}".`
            });
        } catch(error) {
            toast({ title: 'Error', description: (error as Error).message || 'Failed to link products.', variant: 'destructive' });
        } finally {
            setIsLinkDialogOpen(false);
        }
    }
    
    const handleCancelMapping = () => {
        setIsMappingDialogOpen(false);
        resetForNextScan();
    };

    const resetForNextScan = () => {
        setScannedBarcode(null);
        setAlreadyMappedItem(null);
        setMappingComplete(false);
        setMappedItemDetails(null);
        setIsMappingDialogOpen(false);
        setIsLinkDialogOpen(false);
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
            {alreadyMappedItem && (
                 <LinkProductDialog
                    isOpen={isLinkDialogOpen}
                    onOpenChange={setIsLinkDialogOpen}
                    sourceProduct={alreadyMappedItem}
                    onLink={handleLinkProduct}
                />
            )}

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

                    {isScannerPaused && !isMappingDialogOpen && !isLinkDialogOpen && (
                         <Card className="bg-muted/50">
                            <CardHeader>
                                <CardTitle>Scan Result</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {alreadyMappedItem ? (
                                    <div className="space-y-4">
                                        <Alert>
                                            <Info className="h-4 w-4" />
                                            <AlertTitle>Barcode Already Mapped</AlertTitle>
                                            <AlertDescription>
                                                This barcode is already linked to: **{alreadyMappedItem.brand} ({alreadyMappedItem.size})**. You can link it to a different product to merge them.
                                            </AlertDescription>
                                        </Alert>
                                         <Button onClick={() => setIsLinkDialogOpen(true)} variant="secondary" className="w-full">
                                            <Link2 className="mr-2 h-4 w-4" />
                                            Link to a Different Product
                                        </Button>
                                    </div>
                                ) : mappingComplete ? (
                                    <Alert variant="default" className="bg-green-100 dark:bg-green-900/30 border-green-500/50">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <AlertTitle>Mapping Successful</AlertTitle>
                                        <AlertDescription>
                                            The barcode has been linked to **{mappedItemDetails?.brand} ({mappedItemDetails?.size})**.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <Alert variant="destructive">
                                        <AlertTitle>New Barcode Detected</AlertTitle>
                                        <AlertDescription>This barcode is not mapped. An error might have occurred.</AlertDescription>
                                    </Alert>
                                )}
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
                                    <Button size="sm" onClick={() => onMap(item.id)}>Select</Button>
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

function LinkProductDialog({ isOpen, onOpenChange, sourceProduct, onLink }: { isOpen: boolean, onOpenChange: (open: boolean) => void, sourceProduct: InventoryItem, onLink: (destinationProductId: string) => void }) {
    const { inventory } = useInventory();
    const [searchTerm, setSearchTerm] = useState('');

    const unmappedInventory = useMemo(() => {
        // Filter for products that don't have a barcode and are not the source product itself
        const potentialTargets = inventory.filter(item => !item.barcodeId && item.id !== sourceProduct.id);
        if (!searchTerm) return potentialTargets;
        return potentialTargets.filter(item =>
            item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [inventory, searchTerm, sourceProduct.id]);
    
    useEffect(() => {
        if(!isOpen) setSearchTerm('');
    }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Link to Existing Product</DialogTitle>
                    <DialogDescription>
                        Select a clean, unmapped product from your inventory to link this barcode to. This will move the barcode and any Godown stock to the selected product and delete the old entry for <span className="font-semibold text-foreground">"{sourceProduct.brand}"</span>.
                    </DialogDescription>
                </DialogHeader>
                 <div className="py-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search for a clean product..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                     <ScrollArea className="h-64 border rounded-md">
                        {unmappedInventory.length > 0 ? (
                            unmappedInventory.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-3 border-b last:border-b-0">
                                    <div>
                                        <p className="font-semibold">{item.brand}</p>
                                        <p className="text-sm text-muted-foreground">{item.size} &bull; {item.category}</p>
                                    </div>
                                    <Button size="sm" onClick={() => onLink(item.id)}>Link</Button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center p-8 text-muted-foreground">
                                No unmapped products to link to.
                            </div>
                        )}
                    </ScrollArea>
                </div>
                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)} variant="outline">Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
