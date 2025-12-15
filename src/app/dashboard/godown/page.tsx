
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Trash2, Loader2, PackagePlus, ArrowRightLeft, FileScan, Unplug, MoreVertical, Archive, GlassWater, ChevronDown, ChevronUp, Warehouse, PackageOpen } from 'lucide-react';
import Link from 'next/link';
import { useMediaQuery } from 'react-responsive';

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
import BulkTransferDialog from '@/components/dashboard/bulk-transfer-dialog';
import BulkTransferToOnBarDialog from '@/components/dashboard/bulk-transfer-to-onbar-dialog';
import ScanBillDialog from '@/components/dashboard/scan-bill-dialog';
import { usePageLoading } from '@/hooks/use-loading';
import { useInventory, InventoryItem, UnprocessedItem } from '@/hooks/use-inventory';
import ProcessDeliveryDialog from '@/components/dashboard/process-delivery-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDateFormat } from '@/hooks/use-date-format';
import AddGodownItemDialog from '@/components/dashboard/add-godown-item-dialog';
import type { AddGodownItemFormValues } from '@/components/dashboard/add-godown-item-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import SelectionActionBar from '@/components/dashboard/selection-action-bar';
import { cn } from '@/lib/utils';
import { subDays } from 'date-fns';


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
    <div className="font-mono font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">
      {formatTime(time)}
    </div>
  );
};


export default function GodownPage() {
    const { formatDate } = useDateFormat();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
    const { 
        inventory,
        unprocessedItems,
        loading,
        processScannedDelivery,
        deleteUnprocessedItems,
        transferToShop,
        transferToOnBar,
        updateBrand,
        updateGodownStock,
        addGodownItem,
        initListeners,
    } = useInventory();
    
    usePageLoading(loading);

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dateOption, setDateOption] = useState<'today' | 'yesterday'>('today');
    const [isScanBillOpen, setIsScanBillOpen] = useState(false);
    const [isAddDeliveryOpen, setIsAddDeliveryOpen] = useState(false);
    const [isTransferShopOpen, setIsTransferShopOpen] = useState(false);
    const [isTransferOnBarOpen, setIsTransferOnBarOpen] = useState(false);
    const [isBulkTransferToShopOpen, setIsBulkTransferToShopOpen] = useState(false);
    const [isBulkTransferToOnBarOpen, setIsBulkTransferToOnBarOpen] = useState(false);
    const [isProcessDeliveryOpen, setIsProcessDeliveryOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [processingItem, setProcessingItem] = useState<any | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [selectedUnprocessedRows, setSelectedUnprocessedRows] = useState<Set<string>>(new Set());
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleteUnprocessedOpen, setIsDeleteUnprocessedOpen] = useState(false);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const { toast } = useToast();

     useEffect(() => {
        const unsub = initListeners(selectedDate);
        return () => unsub();
    }, [selectedDate, initListeners]);

    const handleDateChange = (value: 'today' | 'yesterday') => {
        const newDate = value === 'today' ? new Date() : subDays(new Date(), 1);
        setSelectedDate(newDate);
        setDateOption(value);
    };
    
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

    const handleAddGodownItem = async (data: AddGodownItemFormValues) => {
        try {
            await addGodownItem(data);
        } catch (error) {
            console.error('Error adding item to godown:', error);
            const errorMessage = (error as Error).message || 'Failed to add item.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    }

    const handleTransferToShop = async (productId: string, quantity: number, price?: number) => {
        try {
            const item = inventory.find(i => i.id === productId);
            if (!item) throw new Error("Product not found");
            await transferToShop(productId, quantity, selectedDate, price);
            toast({ title: 'Transfer Successful', description: `${quantity} units of ${item.brand} (${item.size}) transferred to shop for ${formatDate(selectedDate, 'dd-MMM')}.` });
            setIsTransferShopOpen(false);
        } catch (error) {
            console.error('Error transferring to shop:', error);
            const errorMessage = (error as Error).message || 'Failed to transfer stock.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };
    
    const handleTransferToOnBar = async (productId: string, quantity: number, pegPrices?: { '30ml': number, '60ml': number }) => {
        try {
            const item = inventory.find(i => i.id === productId);
            if (!item) throw new Error("Product not found.");
            await transferToOnBar(productId, quantity, pegPrices);
            toast({ title: 'Transfer Successful', description: `${quantity} units of ${item.brand} (${item.size}) transferred to On-Bar.` });
            setIsTransferOnBarOpen(false);
        } catch (error) {
            console.error('Error transferring to on-bar:', error);
            const errorMessage = (error as Error).message || 'Failed to transfer stock.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    }

    const handleRemoveSelected = async () => {
        const numSelected = selectedRows.size;
        setIsDeleteDialogOpen(false);
        try {
            // This is a safe-delete, only clearing godown stock
            const promises = Array.from(selectedRows).map(id => updateBrand(id, { stockInGodown: 0 }));
            await Promise.all(promises);
            toast({ title: 'Stock Cleared', description: `Godown stock for ${numSelected} selected product(s) has been cleared.` });
            setSelectedRows(new Set());
        } catch (error) {
            console.error('Error removing products from Godown:', error);
            toast({ title: 'Error', description: (error as Error).message || 'Failed to remove selected products.', variant: 'destructive' });
        }
    };
    
    const handleDeleteUnprocessed = async () => {
        const numSelected = selectedUnprocessedRows.size;
        setIsDeleteUnprocessedOpen(false);
        try {
            await deleteUnprocessedItems(Array.from(selectedUnprocessedRows));
            toast({ title: 'Success', description: `Removed ${numSelected} unprocessed item(s).` });
            setSelectedUnprocessedRows(new Set());
        } catch (error) {
             toast({ title: 'Error', description: (error as Error).message || 'Failed to remove items.', variant: 'destructive' });
        }
    };

    const handleGodownStockChange = async (id: string, value: string) => {
        const item = inventory.find(i => i.id === id);
        if (!item) return;
        const newStock = Number(value);
        if (isNaN(newStock) || newStock < 0) {
            toast({ title: 'Invalid Input', description: 'Please enter a valid non-negative number.', variant: 'destructive' });
            return;
        }

        try {
            await updateGodownStock(id, newStock);
            toast({ title: 'Stock Updated', description: `Godown stock for ${item.brand} (${item.size}) updated to ${newStock} units.` });
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
        setExpandedRow(prev => prev === itemId ? null : itemId);
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

    const selectedItemsForBulkTransfer = useMemo(() => {
        return inventory.filter(item => selectedRows.has(item.id));
    }, [inventory, selectedRows]);
    
  if (loading) {
      return null;
  }

  return (
    <main className={cn("flex-1 p-4 md:p-8", (selectedRows.size > 0 || selectedUnprocessedRows.size > 0) && "pb-24")}>
        {selectedRows.size > 0 && (
            <SelectionActionBar
                count={selectedRows.size}
                onClear={() => setSelectedRows(new Set())}
            >
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="sm">
                            <PackageOpen className="mr-2 h-4 w-4" /> Transfer Selected
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setIsBulkTransferToShopOpen(true)}>
                            <Warehouse className="mr-2 h-4 w-4" /> To Shop
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setIsBulkTransferToOnBarOpen(true)}>
                            <GlassWater className="mr-2 h-4 w-4" /> To On-Bar
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                 <Button onClick={() => setIsDeleteDialogOpen(true)} size="sm" variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Remove Stock
                </Button>
            </SelectionActionBar>
        )}
        {selectedUnprocessedRows.size > 0 && (
             <SelectionActionBar
                count={selectedUnprocessedRows.size}
                onClear={() => setSelectedUnprocessedRows(new Set())}
            >
                <Button onClick={() => setIsDeleteUnprocessedOpen(true)} size="sm" variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                </Button>
            </SelectionActionBar>
        )}
        
        {selectedItem && (
            <TransferToShopDialog
                isOpen={isTransferShopOpen}
                onOpenChange={setIsTransferShopOpen}
                item={selectedItem}
                onTransfer={handleTransferToShop}
                selectedDate={selectedDate}
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
        {isBulkTransferToShopOpen && (
            <BulkTransferDialog
                isOpen={isBulkTransferToShopOpen}
                onOpenChange={setIsBulkTransferToShopOpen}
                items={selectedItemsForBulkTransfer}
                onBulkTransfer={async (items) => {
                    try {
                        const promises = items.map(item => transferToShop(item.productId, item.quantity, selectedDate, item.price));
                        await Promise.all(promises);
                        toast({ title: 'Bulk Transfer Successful', description: `${items.length} item types transferred to Shop for ${formatDate(selectedDate, 'dd-MMM')}.`});
                        setIsBulkTransferToShopOpen(false);
                        setSelectedRows(new Set());
                    } catch(e) {
                         const errorMessage = (e as Error).message || 'An unexpected error occurred.';
                         toast({ title: 'Bulk Transfer Failed', description: errorMessage, variant: 'destructive' });
                    }
                }}
            />
        )}
         {isBulkTransferToOnBarOpen && (
            <BulkTransferToOnBarDialog
                isOpen={isBulkTransferToOnBarOpen}
                onOpenChange={setIsBulkTransferToOnBarOpen}
                items={selectedItemsForBulkTransfer}
                onBulkTransfer={async (items) => {
                    try {
                        const promises = items.map(item => transferToOnBar(item.productId, item.quantity, item.pegPrices));
                        await Promise.all(promises);
                        toast({ title: 'Bulk Transfer Successful', description: `${items.length} item types transferred to On-Bar.`});
                        setIsBulkTransferToOnBarOpen(false);
                        setSelectedRows(new Set());
                    } catch(e) {
                         const errorMessage = (e as Error).message || 'An unexpected error occurred.';
                         toast({ title: 'Bulk Transfer Failed', description: errorMessage, variant: 'destructive' });
                    }
                }}
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
        <AddGodownItemDialog
            isOpen={isAddDeliveryOpen}
            onOpenChange={setIsAddDeliveryOpen}
            onAddItem={handleAddGodownItem}
        />
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will set the godown stock for the selected product(s) to zero. This action does not delete the product from your main inventory list.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveSelected} className="bg-destructive hover:bg-destructive/90">
                        Clear Stock
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
        
        <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Godown Stock</h1>
            <div className="flex items-center gap-2">
                <p className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">{formatDate(new Date(), 'dd-MMM-yyyy, EEEE')}</p>
                <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">&bull;</span>
                <RealTimeClock />
            </div>
        </div>

        <div className="md:hidden grid grid-cols-2 gap-2 mb-6">
            <Button variant="outline" asChild>
                <Link href="/dashboard/inventory">
                    <Warehouse className="mr-2 h-4 w-4" />
                    Off-Counter
                </Link>
            </Button>
            <Button variant="outline" asChild>
                <Link href="/dashboard/onbar">
                    <GlassWater className="mr-2 h-4 w-4" />
                    On-Bar
                </Link>
            </Button>
        </div>

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
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-48 w-full">
                        <div className="space-y-3">
                        {unprocessedItems.map(item => (
                             <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-background/50">
                                <div className="flex items-center gap-4">
                                     <Checkbox
                                        id={`unprocessed-${item.id}`}
                                        checked={selectedUnprocessedRows.has(item.id)}
                                        onCheckedChange={() => handleUnprocessedRowSelect(item.id)}
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
                        <Select onValueChange={handleDateChange} value={dateOption}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Select Date" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="yesterday">Yesterday</SelectItem>
                            </SelectContent>
                        </Select>
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
                         <Button className="w-full sm:w-auto" onClick={() => setIsAddDeliveryOpen(true)}>
                            <PackagePlus className="mr-2 h-4 w-4" /> Add Delivery
                        </Button>
                        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsScanBillOpen(true)}>
                            <FileScan className="mr-2 h-4 w-4" /> Scan Bill
                        </Button>
                    </div>
                </div>
                
                <div className={selectedRows.size > 0 ? 'pb-24 md:pb-0' : ''}>
                {isMobile ? (
                    <div className="space-y-3">
                        {filteredInventory.length > 0 ? (
                             filteredInventory.map(item => {
                                const isExpanded = expandedRow === item.id;
                                return (
                                    <Card key={item.id} className="p-4 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-start gap-3 flex-1">
                                                 <Checkbox
                                                    id={`select-${item.id}`}
                                                    className="mt-1"
                                                    checked={selectedRows.has(item.id)}
                                                    onCheckedChange={() => handleRowSelect(item.id)}
                                                />
                                                <div>
                                                    <h3 className="font-bold">{item.brand}</h3>
                                                    <p className="text-sm text-muted-foreground">{item.size}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Label htmlFor={`stock-${item.id}`} className="text-xs">Godown Stock</Label>
                                                <Input
                                                    id={`stock-${item.id}`}
                                                    key={item.id + '-' + item.stockInGodown}
                                                    type="number"
                                                    className="h-9 w-24 text-right mt-1"
                                                    defaultValue={item.stockInGodown || 0}
                                                    onBlur={(e) => handleGodownStockChange(item.id, e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                />
                                            </div>
                                        </div>
                                         
                                        <button onClick={() => toggleRowExpansion(item.id)} className="w-full text-sm text-muted-foreground flex items-center justify-center pt-2">
                                             {isExpanded ? 'Hide' : 'Show'} Details {isExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                                        </button>
                                        {isExpanded && (
                                            <div className="border-t pt-4 mt-4 space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="font-semibold">Date Added:</span>
                                                    <span className="text-muted-foreground">{item.dateAddedToGodown ? formatDate(item.dateAddedToGodown.toDate()) : 'N/A'}</span>
                                                </div>
                                                 <div className="flex justify-between">
                                                    <span className="font-semibold">Last Transfer:</span>
                                                    {item.lastTransferred && item.lastTransferred.date ? (
                                                        <span className="text-muted-foreground text-right">
                                                            {item.lastTransferred.quantity} units to {item.lastTransferred.destination} on {formatDate(item.lastTransferred.date.toDate())}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">N/A</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                )
                             })
                        ) : (
                            <div className="h-24 text-center flex items-center justify-center text-muted-foreground">
                                No stock found in Godown.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead className="font-bold text-foreground">Brand</TableHead>
                                <TableHead className="font-bold text-foreground">Size</TableHead>
                                <TableHead className="font-bold text-foreground">Godown Stock</TableHead>
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
                                                        {expandedRow === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </Button>
                                                    <Checkbox
                                                        id={`desktop-select-${item.id}`}
                                                        checked={selectedRows.has(item.id)}
                                                        onCheckedChange={() => handleRowSelect(item.id)}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">{item.brand}</TableCell>
                                            <TableCell>{item.size}</TableCell>
                                            <TableCell>
                                                <Input
                                                    key={item.id + '-' + item.stockInGodown}
                                                    type="number"
                                                    className="h-8 w-24 bg-card"
                                                    defaultValue={item.stockInGodown || 0}
                                                    onBlur={(e) => handleGodownStockChange(item.id, e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                        {expandedRow === item.id && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="p-0">
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
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No stock found in Godown. Use 'Scan Bill' to add new deliveries.
                                    </TableCell>
                                </TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </div>
                )}
                </div>
            </CardContent>
        </Card>
    </main>
  );
}

    