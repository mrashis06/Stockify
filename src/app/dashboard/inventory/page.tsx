
"use client";

import React, { useState, useMemo } from 'react';
import { IndianRupee, Plus, Search, Trash2, ListFilter, Loader2, Pencil, LogOut } from 'lucide-react';

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
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import AddBrandDialog from '@/components/dashboard/add-brand-dialog';
import EditBrandDialog from '@/components/dashboard/edit-brand-dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from '@/hooks/use-toast';
import { useInventory, InventoryItem } from '@/hooks/use-inventory';
import { useEndOfDay } from '@/hooks/use-end-of-day';
import { useOnBarInventory } from '@/hooks/use-onbar-inventory';
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
import { usePageLoading } from '@/hooks/use-loading';


export default function InventoryPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
    const { 
        inventory,
        loading,
        addBrand,
        deleteBrand,
        updateBrand,
        updateItemField,
    } = useInventory();
    
    usePageLoading(loading);
    const { isEndingDay, endOfDayProcess } = useEndOfDay();
    const { onBarInventory } = useOnBarInventory();


    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [isAddBrandOpen, setIsAddBrandOpen] = useState(false);
    const [isEditBrandOpen, setIsEditBrandOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState<InventoryItem | null>(null);
    const [showOpening, setShowOpening] = useState(true);
    const [showClosing, setShowClosing] = useState(true);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isEndOfDayDialogOpen, setIsEndOfDayDialogOpen] = useState(false);
    const { toast } = useToast();

    const handleAddBrand = async (newItemData: Omit<InventoryItem, 'id' | 'added' | 'sales' | 'opening' | 'closing'>) => {
        try {
            await addBrand(newItemData);
            toast({ title: 'Success', description: 'New brand added successfully.' });
        } catch (error) {
            console.error('Error adding brand:', error);
            const errorMessage = (error as Error).message || 'Failed to add new brand.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };
    
    const handleEditBrand = (brand: InventoryItem) => {
        setEditingBrand(brand);
        setIsEditBrandOpen(true);
    };

    const handleUpdateBrand = async (id: string, data: Partial<Omit<InventoryItem, 'id'>>) => {
        try {
            await updateBrand(id, data);
            toast({ title: 'Success', description: 'Brand updated successfully.' });
        } catch (error) {
            console.error('Error updating brand:', error);
            toast({ title: 'Error', description: 'Failed to update brand.', variant: 'destructive' });
        }
    };
    
    const handleFieldChange = async (id: string, field: 'added' | 'sales' | 'price' | 'size', value: string | number) => {
        const originalItem = inventory.find(item => item.id === id);
        if (!originalItem) return;

        let processedValue: number | string = value;
        if (field === 'added' || field === 'sales' || field === 'price') {
             processedValue = Number(value);
             if (isNaN(processedValue) || processedValue < 0) {
                 toast({ title: 'Invalid Input', description: 'Please enter a valid non-negative number.', variant: 'destructive'});
                 // Re-render will reset to original value from state
                 return;
             }
        }
       
        try {
            await updateItemField(id, field, processedValue);
            toast({ title: 'Success', description: `Item ${field} updated.`});
        } catch (error) {
            console.error(`Error updating ${field}:`, error);
            const errorMessage = (error as Error).message || `Failed to update ${field}.`;
            toast({ title: 'Error', description: errorMessage, variant: 'destructive'});
        }
    };


    const handleDeleteSelected = async () => {
        try {
            await Promise.all(Array.from(selectedRows).map(id => deleteBrand(id)));
            toast({ title: 'Success', description: 'Selected brands removed.' });
            setSelectedRows(new Set());
        } catch (error) {
            console.error('Error removing brands:', error);
            toast({ title: 'Error', description: 'Failed to remove selected brands.', variant: 'destructive' });
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

    const handleEndOfDay = async () => {
        setIsEndOfDayDialogOpen(false);
        try {
            await endOfDayProcess();
            toast({
                title: 'End of Day Successful',
                description: 'Today\'s inventory has been closed and tomorrow\'s has been prepared.'
            });
        } catch (error) {
            console.error("End of day process failed:", error);
            toast({
                title: 'End of Day Failed',
                description: (error as Error).message || 'An unexpected error occurred.',
                variant: 'destructive',
            });
        }
    };

    const processedInventory = useMemo(() => {
        return inventory.map(item => {
            const opening = (item.prevStock ?? 0) + (item.added ?? 0);
            const closing = opening - (item.sales ?? 0);
            return {
                ...item,
                opening,
                closing,
            };
        });
    }, [inventory]);

    const filteredInventory = useMemo(() => {
        return processedInventory.filter(item => {
            const matchesSearch = item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'All Categories' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [processedInventory, searchQuery, categoryFilter]);

    const allCategories = useMemo(() => {
        const cats = new Set(inventory.map(i => i.category).filter(Boolean));
        return ['All Categories', ...Array.from(cats).sort()];
    }, [inventory]);

    const totalAmount = useMemo(() => {
        return filteredInventory.reduce((total, item) => total + (item.sales ?? 0) * item.price, 0);
    }, [filteredInventory]);

    const totalOnBarSales = useMemo(() => {
        return onBarInventory.reduce((total, item) => total + (item.salesValue || 0), 0);
    }, [onBarInventory]);

    const soldOnBarItems = useMemo(() => {
        return onBarInventory.filter(item => item.salesVolume > 0);
    }, [onBarInventory]);

  if (loading) {
    return null;
  }

  return (
    <main className="flex-1 p-4 md:p-8">
        <AddBrandDialog
            isOpen={isAddBrandOpen}
            onOpenChange={setIsAddBrandOpen}
            onAddBrand={handleAddBrand}
        />
        {editingBrand && (
            <EditBrandDialog
                isOpen={isEditBrandOpen}
                onOpenChange={setIsEditBrandOpen}
                brandData={editingBrand}
                onUpdateBrand={handleUpdateBrand}
            />
        )}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the selected brand(s) and all associated data. This action cannot be undone.
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
        <AlertDialog open={isEndOfDayDialogOpen} onOpenChange={setIsEndOfDayDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>End of Day Process</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to close today's inventory? This will finalize all sales and stock for today and prepare the inventory for tomorrow. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEndOfDay} disabled={isEndingDay}>
                         {isEndingDay ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Confirm End of Day
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <h1 className="text-2xl font-bold tracking-tight mb-6">OffCounter Inventory</h1>
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
                    <div className="flex w-full md:w-auto justify-end flex-wrap gap-2">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full sm:w-auto min-w-[180px]">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                {allCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    <ListFilter className="mr-2 h-4 w-4" />
                                    Columns
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem
                                    checked={showOpening}
                                    onCheckedChange={setShowOpening}
                                >
                                    Opening Stock
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={showClosing}
                                    onCheckedChange={setShowClosing}
                                >
                                    Closing Stock
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setIsAddBrandOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add Brand
                        </Button>
                        <Button variant="destructive" disabled={selectedRows.size === 0} onClick={() => setIsDeleteDialogOpen(true)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Remove ({selectedRows.size})
                        </Button>
                    </div>
                </div>
                 <div className="flex justify-end mt-4">
                     <Button onClick={() => setIsEndOfDayDialogOpen(true)} variant="outline" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isEndingDay}>
                        <LogOut className="mr-2 h-4 w-4" /> End of Day
                    </Button>
                </div>

                <div className="overflow-x-auto mt-4">
                    
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="font-bold text-foreground"></TableHead>
                            <TableHead className="font-bold text-foreground">Brand</TableHead>
                            <TableHead className="font-bold text-foreground">Size</TableHead>
                            <TableHead className="font-bold text-foreground">Price</TableHead>
                            <TableHead className="font-bold text-foreground">Prev. Stock</TableHead>
                            <TableHead className="font-bold text-foreground">Added</TableHead>
                            {showOpening && <TableHead className="font-bold text-foreground">Opening</TableHead>}
                            <TableHead className="font-bold text-foreground">Sales</TableHead>
                            {showClosing && <TableHead className="font-bold text-foreground">Closing</TableHead>}
                            <TableHead className="font-bold text-foreground">Amount</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredInventory.map(item => {
                            const isLowStock = (item.closing ?? 0) < 10;
                            const amount = (item.sales ?? 0) * item.price;

                            return (
                                <TableRow 
                                    key={item.id} 
                                    className={isLowStock ? 'bg-destructive/10 hover:bg-destructive/20' : ''}
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
                                    <TableCell className="font-medium flex items-center">
                                        {item.brand}
                                        <Button variant="ghost" size="icon" className="h-6 w-6 ml-2" onClick={() => handleEditBrand(item)}>
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                    </TableCell>
                                    <TableCell>
                                       {item.size}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center">
                                            <IndianRupee className="h-4 w-4 mr-1 shrink-0" />
                                            <Input
                                                type="number"
                                                className="h-8 w-24 bg-card"
                                                defaultValue={item.price}
                                                onBlur={(e) => handleFieldChange(item.id, 'price', e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell>{item.prevStock ?? 0}</TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className="h-8 w-20 bg-card"
                                            placeholder={(item.added ?? 0).toString()}
                                            onBlur={(e) => handleFieldChange(item.id, 'added', e.target.value || '0')}
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                        />
                                    </TableCell>
                                    {showOpening && <TableCell>{item.opening}</TableCell>}
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className={`h-8 w-20 bg-card ${isLowStock && (item.sales ?? 0) > 0 ? 'bg-destructive/50' : ''}`}
                                            placeholder={(item.sales ?? 0).toString()}
                                            onBlur={(e) => handleFieldChange(item.id, 'sales', e.target.value || '0')}
                                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                        />
                                    </TableCell>
                                    {showClosing && <TableCell className={isLowStock ? 'text-destructive font-bold' : ''}>{item.closing}</TableCell>}
                                    <TableCell>
                                        <div className="flex items-center">
                                            <IndianRupee className="h-4 w-4 mr-1 shrink-0" />
                                            {amount.toLocaleString('en-IN')}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        </TableBody>
                         <TableFooter>
                            <TableRow>
                                <TableCell colSpan={showOpening && showClosing ? 9 : 7} className="text-right font-bold text-lg">Total Bottle Sales</TableCell>
                                <TableCell colSpan={2} className="font-bold text-lg">
                                    <div className="flex items-center">
                                        <IndianRupee className="h-5 w-5 mr-1 shrink-0" />
                                        {totalAmount.toLocaleString('en-IN')}
                                    </div>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell colSpan={showOpening && showClosing ? 9 : 7} className="text-right font-medium">Today's On-Bar Sales</TableCell>
                                <TableCell colSpan={2} className="font-medium">
                                    <div className="flex items-center">
                                        <IndianRupee className="h-4 w-4 mr-1 shrink-0" />
                                        {totalOnBarSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </TableCell>
                            </TableRow>
                            {soldOnBarItems.length > 0 && (
                                <>
                                    {soldOnBarItems.map(item => (
                                        <TableRow key={`onbar-${item.id}`} className="text-xs">
                                            <TableCell colSpan={showOpening && showClosing ? 9 : 7} className="text-right italic text-muted-foreground pr-4">
                                                {item.brand}
                                            </TableCell>
                                            <TableCell colSpan={2} className="italic text-muted-foreground">
                                                {item.category === 'Beer' 
                                                    ? `${item.salesVolume} units` 
                                                    : <>{item.salesVolume}<span className="ml-1">ml</span></>
                                                }
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </>
                            )}
                             <TableRow className="border-t-2 border-primary/50">
                                <TableCell colSpan={showOpening && showClosing ? 9 : 7} className="text-right font-extrabold text-xl text-primary">Grand Total Sales</TableCell>
                                <TableCell colSpan={2} className="font-extrabold text-xl text-primary">
                                    <div className="flex items-center">
                                        <IndianRupee className="h-6 w-6 mr-1 shrink-0" />
                                        {(totalAmount + totalOnBarSales).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                    
                </div>
            </CardContent>
        </Card>
    </main>
  );
}

    

    
