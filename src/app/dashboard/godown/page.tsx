

"use client";

import React, { useState, useMemo } from 'react';
import { Plus, Search, Trash2, Loader2, PackagePlus, ArrowRightLeft, FileScan, Unplug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import TransferToShopDialog from '@/components/dashboard/transfer-to-shop-dialog';
import ScanBillDialog from '@/components/dashboard/scan-bill-dialog';
import { usePageLoading } from '@/hooks/use-loading';
import { useInventory, InventoryItem } from '@/hooks/use-inventory';
import ProcessDeliveryDialog from '@/components/dashboard/process-delivery-dialog';

export default function GodownPage() {
    const { 
        inventory,
        unprocessedItems,
        loading,
        addItemsFromBillToHolding,
        processScannedDelivery,
        deleteBrand: deleteProduct,
        transferToShop,
        forceRefetch
    } = useInventory();
    
    usePageLoading(loading);

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [isScanBillOpen, setIsScanBillOpen] = useState(false);
    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [isProcessDeliveryOpen, setIsProcessDeliveryOpen] = useState(false);
    const [transferringItem, setTransferringItem] = useState<InventoryItem | null>(null);
    const [processingItem, setProcessingItem] = useState<any | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const { toast } = useToast();
    
    const handleOpenTransferDialog = (item: InventoryItem) => {
        setTransferringItem(item);
        setIsTransferOpen(true);
    };

    const handleOpenProcessDialog = (item: any) => {
        setProcessingItem(item);
        setIsProcessDeliveryOpen(true);
    }

    const handleTransfer = async (productId: string, quantity: number, price?: number) => {
        try {
            await transferToShop(productId, quantity, price);
            toast({ title: 'Success', description: `${quantity} units transferred to shop.` });
            setIsTransferOpen(false);
        } catch (error) {
            console.error('Error transferring to shop:', error);
            const errorMessage = (error as Error).message || 'Failed to transfer stock.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };

    const handleDeleteSelected = async () => {
        try {
            await Promise.all(Array.from(selectedRows).map(id => deleteProduct(id)));
            toast({ title: 'Success', description: 'Selected products removed.' });
            setSelectedRows(new Set());
            await forceRefetch();
        } catch (error) {
            console.error('Error removing products:', error);
            toast({ title: 'Error', description: (error as Error).message || 'Failed to remove selected products.', variant: 'destructive' });
        }
        setIsDeleteDialogOpen(false);
    };
    
    const handleRowSelect = (productId: string) => {
        const newSelection = new Set(selectedRows);
        if (newSelection.has(productId)) {
            newSelection.delete(productId);
        } else {
            newSelection.add(productId);
        }
        setSelectedRows(newSelection);
    };

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const matchesSearch = item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'All Categories' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [inventory, searchQuery, categoryFilter]);

    const allCategories = useMemo(() => {
        const cats = new Set(inventory.map(i => i.category).filter(Boolean));
        return ['All Categories', ...Array.from(cats).sort()];
    }, [inventory]);
    
  if (loading) {
      return null;
  }

  return (
    <main className="flex-1 p-4 md:p-8">
        {transferringItem && (
            <TransferToShopDialog
                isOpen={isTransferOpen}
                onOpenChange={setIsTransferOpen}
                item={transferringItem}
                onTransfer={handleTransfer}
            />
        )}
        {processingItem && (
            <ProcessDeliveryDialog 
                isOpen={isProcessDeliveryOpen}
                onOpenChange={setIsProcessDeliveryOpen}
                unprocessedItem={processingItem}
                onProcess={processScannedDelivery}
            />
        )}
        <ScanBillDialog 
            isOpen={isScanBillOpen}
            onOpenChange={setIsScanBillOpen}
            onAddItems={async (items) => {
                try {
                    const count = await addItemsFromBillToHolding(items);
                    toast({ title: 'Bill Scanned', description: `${count} item types sent to the holding area for processing.` });
                } catch(e) {
                    const errorMessage = e instanceof Error ? e.message : 'Failed to add items from bill.';
                    toast({ title: 'Error', description: errorMessage, variant: 'destructive'});
                }
            }}
        />
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the selected product(s). This action can only be done if both Godown and Shop stock are zero.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive hover:bg-destructive/90">
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {unprocessedItems.length > 0 && (
            <Card className="mb-6 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Unplug className="h-8 w-8 text-amber-600" />
                            <div>
                                <h3 className="font-semibold text-amber-800 dark:text-amber-200">Unprocessed Deliveries</h3>
                                <p className="text-sm text-amber-700 dark:text-amber-300">You have {unprocessedItems.length} item types from scanned bills that need to be mapped to your inventory.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto">
                            {unprocessedItems.slice(0, 2).map(item => (
                                <Button key={item.id} variant="outline" className="bg-amber-100 dark:bg-amber-900" onClick={() => handleOpenProcessDialog(item)}>
                                    Process: {item.brand} ({item.quantity})
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}
       
        <h1 className="text-2xl font-bold tracking-tight mb-6">Godown Stock</h1>
        <Card>
            <CardContent className="p-4 md:p-6">
                 <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                    <div className="relative w-full md:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search brands..."
                            className="pl-10 w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                         />
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                {allCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsScanBillOpen(true)}>
                            <FileScan className="mr-2 h-4 w-4" /> Scan Bill
                        </Button>
                        <Button variant="destructive" disabled={selectedRows.size === 0} onClick={() => setIsDeleteDialogOpen(true)} className="w-full sm:w-auto">
                            <Trash2 className="mr-2 h-4 w-4" /> Remove ({selectedRows.size})
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead className="font-bold text-foreground">Brand</TableHead>
                            <TableHead className="font-bold text-foreground">Size</TableHead>
                            <TableHead className="font-bold text-foreground">Category</TableHead>
                            <TableHead className="font-bold text-foreground w-40">Godown Stock</TableHead>
                            <TableHead className="font-bold text-foreground text-center w-48">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredInventory.map(item => (
                            <React.Fragment key={item.id}>
                                <TableRow data-state={selectedRows.has(item.id) ? "selected" : ""}>
                                     <TableCell className="text-center">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4"
                                            checked={selectedRows.has(item.id)}
                                            onChange={() => handleRowSelect(item.id)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{item.brand}</TableCell>
                                    <TableCell>{item.size}</TableCell>
                                    <TableCell>{item.category}</TableCell>
                                    <TableCell>{item.stockInGodown || 0}</TableCell>
                                    <TableCell className="text-center">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenTransferDialog(item)} disabled={(item.stockInGodown || 0) <= 0}>
                                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                                            Transfer to Shop
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            </React.Fragment>
                        ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </main>
  );
}
