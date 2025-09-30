

"use client";

import React, { useState, useMemo } from 'react';
import { Plus, Search, Trash2, Loader2, PackagePlus, ArrowRightLeft, FileScan, Unplug, MoreVertical, Archive, GlassWater, ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import TransferToOnBarDialog from '@/components/dashboard/transfer-to-onbar-dialog';
import ScanBillDialog from '@/components/dashboard/scan-bill-dialog';
import { usePageLoading } from '@/hooks/use-loading';
import { useInventory, InventoryItem, UnprocessedItem } from '@/hooks/use-inventory';
import ProcessDeliveryDialog from '@/components/dashboard/process-delivery-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDateFormat } from '@/hooks/use-date-format';


export default function GodownPage() {
    const { formatDate } = useDateFormat();
    const { 
        inventory,
        unprocessedItems,
        loading,
        processScannedDelivery,
        deleteUnprocessedItems,
        transferToShop,
        transferToOnBar,
        forceRefetch,
        updateBrand,
        updateGodownStock,
    } = useInventory();
    
    usePageLoading(loading);

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [isScanBillOpen, setIsScanBillOpen] = useState(false);
    const [isTransferShopOpen, setIsTransferShopOpen] = useState(false);
    const [isTransferOnBarOpen, setIsTransferOnBarOpen] = useState(false);
    const [isProcessDeliveryOpen, setIsProcessDeliveryOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [processingItem, setProcessingItem] = useState<any | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [selectedUnprocessedRows, setSelectedUnprocessedRows] = useState<Set<string>>(new Set());
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleteUnprocessedOpen, setIsDeleteUnprocessedOpen] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const { toast } = useToast();
    
    const handleOpenTransferDialog = (item: InventoryItem, destination: 'shop' | 'onbar') => {
        setSelectedItem(item);
        if (destination === 'shop') {
            setIsTransferShopOpen(true);
        } else {
            setIsTransferOnBarOpen(true);
        }
    };

    const handleOpenProcessDialog = (item: any) => {
        setProcessingItem(item);
        setIsProcessDeliveryOpen(true);
    }

    const handleTransferToShop = async (productId: string, quantity: number, price?: number) => {
        try {
            await transferToShop(productId, quantity, price);
            toast({ title: 'Success', description: `${quantity} units transferred to shop.` });
            setIsTransferShopOpen(false);
            forceRefetch();
        } catch (error) {
            console.error('Error transferring to shop:', error);
            const errorMessage = (error as Error).message || 'Failed to transfer stock.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };
    
    const handleTransferToOnBar = async (productId: string, quantity: number, pegPrices?: { '30ml': number, '60ml': number }) => {
        try {
            await transferToOnBar(productId, quantity, pegPrices);
            const item = inventory.find(i => i.id === productId);
            toast({ title: 'Success', description: `${item?.brand} transferred to On-Bar.` });
            setIsTransferOnBarOpen(false);
            forceRefetch();
        } catch (error) {
            console.error('Error transferring to on-bar:', error);
            const errorMessage = (error as Error).message || 'Failed to transfer stock.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    }

    const handleRemoveSelected = async () => {
        setIsDeleteDialogOpen(false);
        try {
            // This is a safe-delete, only clearing godown stock
            const promises = Array.from(selectedRows).map(id => updateBrand(id, { stockInGodown: 0 }));
            await Promise.all(promises);
            toast({ title: 'Success', description: 'Selected products removed from Godown.' });
            setSelectedRows(new Set());
            forceRefetch();
        } catch (error) {
            console.error('Error removing products from Godown:', error);
            toast({ title: 'Error', description: (error as Error).message || 'Failed to remove selected products.', variant: 'destructive' });
        }
    };
    
    const handleDeleteUnprocessed = async () => {
        setIsDeleteUnprocessedOpen(false);
        try {
            await deleteUnprocessedItems(Array.from(selectedUnprocessedRows));
            toast({ title: 'Success', description: 'Selected unprocessed items removed.' });
            setSelectedUnprocessedRows(new Set());
        } catch (error) {
             toast({ title: 'Error', description: (error as Error).message || 'Failed to remove items.', variant: 'destructive' });
        }
    };

    const handleGodownStockChange = async (id: string, value: string) => {
        const newStock = Number(value);
        if (isNaN(newStock) || newStock < 0) {
            toast({ title: 'Invalid Input', description: 'Please enter a valid non-negative number.', variant: 'destructive' });
            // Re-render will reset to original value from state
            forceRefetch();
            return;
        }

        try {
            await updateGodownStock(id, newStock);
            toast({ title: 'Success', description: `Godown stock updated.` });
        } catch (error) {
            console.error(`Error updating godown stock:`, error);
            const errorMessage = (error as Error).message || `Failed to update stock.`;
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
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

    const handleUnprocessedRowSelect = (itemId: string) => {
        const newSelection = new Set(selectedUnprocessedRows);
        if (newSelection.has(itemId)) {
            newSelection.delete(itemId);
        } else {
            newSelection.add(itemId);
        }
        setSelectedUnprocessedRows(newSelection);
    };

    const toggleRowExpansion = (itemId: string) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(itemId)) {
            newSet.delete(itemId);
        } else {
            newSet.add(itemId);
        }
        setExpandedRows(newSet);
    };

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const hasGodownStock = (item.stockInGodown || 0) > 0;
            if (!hasGodownStock) return false;

            const matchesSearch = item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'All Categories' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [inventory, searchQuery, categoryFilter]);

    const allCategories = useMemo(() => {
        const cats = new Set(inventory.filter(i => (i.stockInGodown || 0) > 0).map(i => i.category).filter(Boolean));
        return ['All Categories', ...Array.from(cats).sort()];
    }, [inventory]);
    
  if (loading) {
      return null;
  }

  return (
    <main className="flex-1 p-4 md:p-8">
        {selectedItem && (
            <TransferToShopDialog
                isOpen={isTransferShopOpen}
                onOpenChange={setIsTransferShopOpen}
                item={selectedItem}
                onTransfer={handleTransferToShop}
            />
        )}
        {selectedItem && (
            <TransferToOnBarDialog
                isOpen={isTransferOnBarOpen}
                onOpenChange={setIsTransferOnBarOpen}
                item={selectedItem}
                onTransfer={handleTransferToOnBar}
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
        />
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will remove the selected product(s) from your Godown by setting their stock to zero. This action does not delete the product from your main inventory.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveSelected} className="bg-destructive hover:bg-destructive/90">
                        Remove Stock
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={isDeleteUnprocessedOpen} onOpenChange={setIsDeleteUnprocessedOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the selected unprocessed item(s). This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteUnprocessed} className="bg-destructive hover:bg-destructive/90">
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {unprocessedItems.length > 0 && (
            <Card className="mb-6 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                                <Unplug className="h-6 w-6" /> Unprocessed Deliveries
                            </CardTitle>
                            <CardDescription className="text-amber-700 dark:text-amber-300 mt-2">
                                You have {unprocessedItems.length} item types from scanned bills that need to be mapped to your inventory.
                            </CardDescription>
                        </div>
                         <Button 
                            variant="destructive" 
                            size="sm" 
                            disabled={selectedUnprocessedRows.size === 0} 
                            onClick={() => setIsDeleteUnprocessedOpen(true)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" /> Remove ({selectedUnprocessedRows.size})
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-48 w-full">
                        <div className="space-y-3">
                        {unprocessedItems.map(item => (
                             <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-amber-100 dark:bg-amber-900/50">
                                <div className="flex items-center gap-4">
                                     <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={selectedUnprocessedRows.has(item.id)}
                                        onChange={() => handleUnprocessedRowSelect(item.id)}
                                    />
                                    <div>
                                        <p className="font-semibold">{item.brand}</p>
                                        <p className="text-sm text-muted-foreground">{item.size} &bull; {item.quantity} units</p>
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => handleOpenProcessDialog(item)}>Process</Button>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
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
                            <TableHead className="font-bold text-foreground">Godown Stock</TableHead>
                            <TableHead className="text-right font-bold text-foreground w-32">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredInventory.length > 0 ? (
                            filteredInventory.map(item => (
                                <React.Fragment key={item.id}>
                                    <TableRow data-state={selectedRows.has(item.id) ? "selected" : ""}>
                                         <TableCell className="text-center">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => toggleRowExpansion(item.id)}
                                                    className="h-8 w-8"
                                                >
                                                    {expandedRows.has(item.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </Button>
                                                <input
                                                    type="checkbox"
                                                    className="h-4 w-4"
                                                    checked={selectedRows.has(item.id)}
                                                    onChange={() => handleRowSelect(item.id)}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{item.brand}</TableCell>
                                        <TableCell>{item.size}</TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                className="h-8 w-24 bg-card"
                                                defaultValue={item.stockInGodown || 0}
                                                onBlur={(e) => handleGodownStockChange(item.id, e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" size="sm" disabled={(item.stockInGodown || 0) <= 0}>
                                                        Actions
                                                        <ChevronDown className="h-4 w-4 ml-2" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem onSelect={() => handleOpenTransferDialog(item, 'shop')}>
                                                        <Archive className="mr-2 h-4 w-4" />
                                                        Transfer to Shop
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleOpenTransferDialog(item, 'onbar')} disabled={!['Whiskey', 'Rum', 'Beer', 'Vodka', 'Wine'].includes(item.category)}>
                                                         <GlassWater className="mr-2 h-4 w-4" />
                                                        Transfer to On-Bar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                    {expandedRows.has(item.id) && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="p-0">
                                                <div className="bg-muted/50 p-4 grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="font-semibold text-sm">Date Added</p>
                                                        <p className="text-sm text-muted-foreground">{item.dateAddedToGodown ? formatDate(item.dateAddedToGodown.toDate()) : 'N/A'}</p>
                                                    </div>
                                                     <div>
                                                        <p className="font-semibold text-sm">Last Transferred</p>
                                                        {item.lastTransferred && item.lastTransferred.date ? (
                                                            <p className="text-sm text-muted-foreground">
                                                                {item.lastTransferred.quantity} units to {item.lastTransferred.destination} on {formatDate(item.lastTransferred.date.toDate())}
                                                            </p>
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground">N/A</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No stock found in Godown. Use 'Scan Bill' to add new deliveries.
                                </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </main>
  );
}
