
"use client";

import React, { useState, useMemo } from 'react';
import { Plus, Search, Trash2, Loader2, PackagePlus, ArrowRightLeft, ChevronDown, ChevronUp, FileScan } from 'lucide-react';

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
import { useGodownInventory, GodownItem } from '@/hooks/use-godown-inventory';
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
import AddGodownItemDialog from '@/components/dashboard/add-godown-item-dialog';
import TransferToShopDialog from '@/components/dashboard/transfer-to-shop-dialog';
import ScanBillDialog from '@/components/dashboard/scan-bill-dialog';
import { usePageLoading } from '@/hooks/use-loading';
import { useDateFormat } from '@/hooks/use-date-format';
import { ScrollArea } from '@/components/ui/scroll-area';

// A new type for our grouped data structure
type GroupedGodownItem = {
    productId: string;
    brand: string;
    size: string;
    category: string;
    totalQuantity: number;
    batches: GodownItem[];
}

export default function GodownPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
    const { 
        godownInventory,
        loading,
        addGodownItem,
        addMultipleGodownItems,
        updateGodownItem,
        deleteGodownItem,
        transferToShop,
        forceRefetch
    } = useGodownInventory();
    
    usePageLoading(loading);
    const { formatDate } = useDateFormat();

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [isScanBillOpen, setIsScanBillOpen] = useState(false);
    const [transferringItem, setTransferringItem] = useState<GroupedGodownItem | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const { toast } = useToast();

    const handleAddItem = async (newItemData: Omit<GodownItem, 'id' | 'productId' | 'dateAdded' | 'transferHistory'>) => {
        try {
            await addGodownItem(newItemData);
            toast({ title: 'Success', description: 'New batch added to godown.' });
        } catch (error) {
            console.error('Error adding godown item:', error);
            const errorMessage = (error as Error).message || 'Failed to add new item.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };
    
    const handleOpenTransferDialog = (item: GroupedGodownItem) => {
        setTransferringItem(item);
        setIsTransferOpen(true);
    };

    const handleTransferToShop = async (productId: string, quantity: number) => {
        try {
            await transferToShop(productId, quantity);
            toast({ title: 'Success', description: `${quantity} units transferred to shop.` });
            setIsTransferOpen(false);
        } catch (error) {
            console.error('Error transferring to shop:', error);
            const errorMessage = (error as Error).message || 'Failed to transfer stock.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };

    const handleQuantityChange = async (id: string, newQuantity: number) => {
        if (isNaN(newQuantity)) return;
        
        if (newQuantity <= 0) {
             try {
                await deleteGodownItem(id);
                toast({ title: 'Success', description: 'Batch removed as quantity is zero.' });
             } catch (error) {
                 console.error('Error removing batch:', error);
                 toast({ title: 'Error', description: 'Failed to remove batch.', variant: 'destructive' });
             }
        } else {
            try {
                await updateGodownItem(id, { quantity: newQuantity });
                toast({ title: 'Success', description: 'Quantity updated.' });
            } catch (error) {
                 console.error('Error updating quantity:', error);
                 toast({ title: 'Error', description: 'Failed to update quantity.', variant: 'destructive' });
            }
        }
    };

    const toggleRowExpansion = (productId: string) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(productId)) {
            newSet.delete(productId);
        } else {
            newSet.add(productId);
        }
        setExpandedRows(newSet);
    };

    const groupedInventory = useMemo(() => {
        const groups = new Map<string, GroupedGodownItem>();
        godownInventory.forEach(item => {
            let group = groups.get(item.productId);
            if (!group) {
                group = {
                    productId: item.productId,
                    brand: item.brand,
                    size: item.size,
                    category: item.category,
                    totalQuantity: 0,
                    batches: [],
                };
            }
            group.totalQuantity += item.quantity;
            group.batches.push(item);
            groups.set(item.productId, group);
        });
        return Array.from(groups.values());
    }, [godownInventory]);


    const filteredInventory = useMemo(() => {
        return groupedInventory.filter(item => {
            const matchesSearch = item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'All Categories' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [groupedInventory, searchQuery, categoryFilter]);

    const allCategories = useMemo(() => {
        const cats = new Set(godownInventory.map(i => i.category).filter(Boolean));
        return ['All Categories', ...Array.from(cats).sort()];
    }, [godownInventory]);
    
  if (loading) {
      return null;
  }

  return (
    <main className="flex-1 p-4 md:p-8">
        <AddGodownItemDialog
            isOpen={isAddItemOpen}
            onOpenChange={setIsAddItemOpen}
            onAddItem={handleAddItem}
        />
        {transferringItem && (
            <TransferToShopDialog
                isOpen={isTransferOpen}
                onOpenChange={setIsTransferOpen}
                item={{
                    // The dialog expects a GodownItem-like structure with quantity
                    // We'll pass the grouped item but the dialog only uses productId and totalQuantity
                    id: transferringItem.productId, 
                    brand: transferringItem.brand,
                    size: transferringItem.size,
                    category: transferringItem.category,
                    quantity: transferringItem.totalQuantity,
                    dateAdded: new Date(), // Dummy value, not used in dialog
                }}
                onTransfer={handleTransferToShop}
            />
        )}
        <ScanBillDialog 
            isOpen={isScanBillOpen}
            onOpenChange={setIsScanBillOpen}
            onAddItems={async (items) => {
                try {
                    const { addedCount, skippedCount } = await addMultipleGodownItems(items);
                    
                    let description = '';
                    if (addedCount > 0) {
                        description += `${addedCount} item types added from the bill. `;
                    }
                    if (skippedCount > 0) {
                        description += `${skippedCount} item types were skipped as they already exist in the godown.`;
                    }

                    if (addedCount === 0 && skippedCount > 0) {
                         toast({ title: 'No new items added', description: description.trim() });
                    } else {
                         toast({ title: 'Success', description: description.trim() });
                    }
                    
                    if (addedCount > 0) {
                        forceRefetch();
                    }
                } catch(e) {
                    toast({ title: 'Error', description: 'Failed to add items from bill.', variant: 'destructive'});
                }
            }}
        />
       
        <h1 className="text-2xl font-bold tracking-tight mb-6">Godown Inventory</h1>
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
                        <Button variant="outline" className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto" onClick={() => setIsAddItemOpen(true)}>
                            <PackagePlus className="mr-2 h-4 w-4" /> Add Item
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
                            <TableHead className="font-bold text-foreground w-40">Total Quantity</TableHead>
                            <TableHead className="font-bold text-foreground text-center w-48">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredInventory.map(item => {
                            const isExpanded = expandedRows.has(item.productId);
                            return (
                            <React.Fragment key={item.productId}>
                                <TableRow>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => toggleRowExpansion(item.productId)} className="h-8 w-8">
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                    </TableCell>
                                    <TableCell className="font-medium">{item.brand}</TableCell>
                                    <TableCell>{item.size}</TableCell>
                                    <TableCell>{item.category}</TableCell>
                                    <TableCell>{item.totalQuantity}</TableCell>
                                    <TableCell className="text-center">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenTransferDialog(item)} disabled={item.totalQuantity <= 0}>
                                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                                            Transfer to Shop
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                {isExpanded && (
                                     <TableRow key={`${item.productId}-details`} className="bg-muted/50 hover:bg-muted/50">
                                        <TableCell colSpan={6} className="p-0">
                                            <div className="p-4">
                                                <h4 className="font-semibold mb-2">Batches for {item.brand} ({item.size})</h4>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="text-foreground">Date Added</TableHead>
                                                            <TableHead className="text-foreground">Transfer History</TableHead>
                                                            <TableHead className="text-foreground w-40">Quantity</TableHead>
                                                            <TableHead className="text-foreground w-24 text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {item.batches.map(batch => (
                                                            <TableRow key={batch.id}>
                                                                <TableCell>{batch.dateAdded ? formatDate(batch.dateAdded.toDate()) : 'N/A'}</TableCell>
                                                                <TableCell>
                                                                    {batch.transferHistory && batch.transferHistory.length > 0 ? (
                                                                         <ScrollArea className="h-20 w-48 rounded-md border p-2 text-xs">
                                                                            {batch.transferHistory.sort((a,b) => b.date.toMillis() - a.date.toMillis()).map((th, index) => (
                                                                                <div key={index} className="mb-1">
                                                                                    {th.quantity} units on {formatDate(th.date.toDate())}
                                                                                </div>
                                                                            ))}
                                                                         </ScrollArea>
                                                                    ) : "N/A"}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-8 w-24 bg-card"
                                                                        defaultValue={batch.quantity}
                                                                        onBlur={(e) => handleQuantityChange(batch.id, parseInt(e.target.value, 10))}
                                                                        min="0"
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleQuantityChange(batch.id, 0)}>
                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        )})}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </main>
  );
}

    
