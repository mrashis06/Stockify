
"use client";

import React, { useState, useMemo } from 'react';
import { Plus, Search, Trash2, ListFilter, Loader2, Pencil, PackagePlus, ArrowRightLeft } from 'lucide-react';

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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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


export default function GodownPage() {
    const { 
        godownInventory,
        loading,
        saving,
        addGodownItem,
        updateGodownItem,
        deleteGodownItem,
        transferToShop,
    } = useGodownInventory();

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [transferringItem, setTransferringItem] = useState<GodownItem | null>(null);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const { toast } = useToast();

    const handleAddItem = async (newItemData: Omit<GodownItem, 'id'>) => {
        try {
            await addGodownItem(newItemData);
            toast({ title: 'Success', description: 'New item added to godown.' });
        } catch (error) {
            console.error('Error adding godown item:', error);
            const errorMessage = (error as Error).message || 'Failed to add new item.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };
    
    const handleOpenTransferDialog = (item: GodownItem) => {
        setTransferringItem(item);
        setIsTransferOpen(true);
    };

    const handleTransferToShop = async (itemId: string, quantity: number) => {
        try {
            await transferToShop(itemId, quantity);
            toast({ title: 'Success', description: `${quantity} units transferred to shop.` });
            setIsTransferOpen(false);
        } catch (error) {
            console.error('Error transferring to shop:', error);
            const errorMessage = (error as Error).message || 'Failed to transfer stock.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };

    const handleQuantityChange = async (id: string, newQuantity: number) => {
        if (isNaN(newQuantity) || newQuantity < 0) return;
        try {
            await updateGodownItem(id, { quantity: newQuantity });
            toast({ title: 'Success', description: 'Quantity updated.' });
        } catch (error) {
             console.error('Error updating quantity:', error);
             toast({ title: 'Error', description: 'Failed to update quantity.', variant: 'destructive' });
        }
    };


    const handleDeleteSelected = async () => {
        try {
            await Promise.all(Array.from(selectedRows).map(id => deleteGodownItem(id)));
            toast({ title: 'Success', description: 'Selected items removed from godown.' });
            setSelectedRows(new Set());
        } catch (error) {
            console.error('Error removing items:', error);
            toast({ title: 'Error', description: 'Failed to remove selected items.', variant: 'destructive' });
        }
        setIsDeleteDialogOpen(false);
    };

    const handleRowSelect = (id: string) => {
        const newSelection = new Set(selectedRows);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedRows(newSelection);
    };


    const filteredInventory = useMemo(() => {
        return godownInventory.filter(item => {
            const matchesSearch = item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'All Categories' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [godownInventory, searchQuery, categoryFilter]);

    const allCategories = useMemo(() => {
        const cats = new Set(godownInventory.map(i => i.category).filter(Boolean));
        return ['All Categories', ...Array.from(cats).sort()];
    }, [godownInventory]);


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
                item={transferringItem}
                onTransfer={handleTransferToShop}
            />
        )}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the selected item(s) from the godown. This action cannot be undone.
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
                        <Button variant="destructive" disabled={selectedRows.size === 0} onClick={() => setIsDeleteDialogOpen(true)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Remove ({selectedRows.size})
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <span className="ml-4 text-muted-foreground">Loading Godown Stock...</span>
                        </div>
                    ) : (
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="font-bold text-foreground w-12"></TableHead>
                            <TableHead className="font-bold text-foreground">Brand</TableHead>
                            <TableHead className="font-bold text-foreground">Size</TableHead>
                            <TableHead className="font-bold text-foreground">Category</TableHead>
                            <TableHead className="font-bold text-foreground w-40">Quantity</TableHead>
                            <TableHead className="font-bold text-foreground text-center w-48">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredInventory.map(item => (
                                <TableRow 
                                    key={item.id}
                                    data-state={selectedRows.has(item.id) ? "selected" : ""}
                                >
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
                                    <TableCell>
                                         <Input
                                            type="number"
                                            className="h-8 w-24 bg-card"
                                            value={item.quantity}
                                            onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value, 10))}
                                            onBlur={(e) => {
                                                // Save on blur if value is valid
                                                const newQuantity = parseInt(e.target.value, 10);
                                                if (!isNaN(newQuantity) && newQuantity >= 0) {
                                                    handleQuantityChange(item.id, newQuantity);
                                                } else {
                                                    // Reset to original value if input is invalid
                                                    e.target.value = item.quantity.toString();
                                                }
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenTransferDialog(item)}>
                                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                                            Transfer to Shop
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        )}
                        </TableBody>
                    </Table>
                    )}
                </div>
            </CardContent>
        </Card>
    </main>
  );
}
