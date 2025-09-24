
"use client";

import React, { useState, useMemo } from 'react';
import { Plus, Search, Trash2, Loader2, PackagePlus, ArrowRightLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

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
import { usePageLoading } from '@/hooks/use-loading';

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
        updateGodownItem,
        deleteGodownItem,
        transferToShop,
    } = useGodownInventory();
    
    usePageLoading(loading);

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [transferringItem, setTransferringItem] = useState<GroupedGodownItem | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const { toast } = useToast();

    const handleAddItem = async (newItemData: Omit<GodownItem, 'id' | 'productId' | 'dateAdded' | 'dateTransferred'>) => {
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
                    ...transferringItem,
                    // The dialog expects a GodownItem-like structure with quantity
                    // We'll pass the grouped item but the dialog only uses productId and totalQuantity
                    id: transferringItem.productId, 
                    quantity: transferringItem.totalQuantity,
                    dateAdded: new Date(), // Dummy value, not used in dialog
                }}
                onTransfer={handleTransferToShop}
            />
        )}
       
        <h1 className="text-2xl font-bold tracking-tight mb-6">Godown Inventory</h1>
        <Card>
            <CardContent className="p-4 md:p-6">
                 <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                    <div className="relative w-full md:w-auto md:min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search brands..."
                            className="pl-10 w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                         />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full md:w-auto min-w-[180px]">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                {allCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setIsAddItemOpen(true)}>
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
                                                            <TableHead className="text-foreground">Last Transferred</TableHead>
                                                            <TableHead className="text-foreground w-40">Quantity</TableHead>
                                                            <TableHead className="text-foreground w-24 text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {item.batches.map(batch => (
                                                            <TableRow key={batch.id}>
                                                                <TableCell>{batch.dateAdded ? format(batch.dateAdded.toDate(), 'PPP') : 'N/A'}</TableCell>
                                                                <TableCell>{batch.dateTransferred ? format(batch.dateTransferred.toDate(), 'PPP') : 'N/A'}</TableCell>
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
