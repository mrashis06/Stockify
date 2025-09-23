
"use client";

import React, { useState, useMemo } from 'react';
import { IndianRupee, Plus, Search, Trash2, ListFilter, Loader2, Pencil } from 'lucide-react';

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


export default function InventoryPage() {
    const { 
        inventory,
        setInventory,
        loading,
        saving,
        addBrand,
        deleteBrand,
        updateBrand,
        saveChanges
    } = useInventory();

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [isAddBrandOpen, setIsAddBrandOpen] = useState(false);
    const [isEditBrandOpen, setIsEditBrandOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState<InventoryItem | null>(null);
    const [showOpening, setShowOpening] = useState(true);
    const [showClosing, setShowClosing] = useState(true);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const { toast } = useToast();

    const handleAddBrand = async (newItemData: Omit<InventoryItem, 'id' | 'added' | 'sales' | 'opening' | 'closing'>) => {
        try {
            await addBrand(newItemData);
            toast({ title: 'Success', description: 'New brand added successfully.' });
        } catch (error) {
            console.error('Error adding brand:', error);
            toast({ title: 'Error', description: 'Failed to add new brand.', variant: 'destructive' });
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

    const handleInputChange = (id: string, field: keyof InventoryItem, value: string) => {
        setInventory(
            inventory.map(item => {
                if (item.id === id) {
                    let processedValue: string | number = value;
                    if (field === 'price' || field === 'prevStock' || field === 'added' || field === 'sales') {
                        processedValue = value === '' ? 0 : parseFloat(value);
                        if (isNaN(processedValue as number)) {
                            processedValue = item[field] as number;
                        }
                    }
                    return { ...item, [field]: processedValue };
                }
                return item;
            })
        );
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

    const handleSaveChanges = async () => {
        try {
            await saveChanges();
            toast({ title: 'Success', description: 'Inventory saved successfully!' });
        } catch (error) {
            console.error("Error saving inventory:", error);
            toast({ title: 'Error', description: 'Failed to save inventory.', variant: 'destructive' });
        }
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

        <h1 className="text-2xl font-bold tracking-tight mb-6">Daily Inventory</h1>
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

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <span className="ml-4 text-muted-foreground">Loading Inventory...</span>
                        </div>
                    ) : (
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
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredInventory.map(item => {
                            const opening = (item.prevStock ?? 0) + (item.added ?? 0);
                            const closing = opening - (item.sales ?? 0);
                            const isLowStock = closing < 10;

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
                                        <Input
                                            type="text"
                                            className="h-8 w-24 bg-card"
                                            value={item.size}
                                            onChange={(e) => handleInputChange(item.id, 'size', e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center">
                                            <IndianRupee className="h-4 w-4 mr-1 shrink-0" />
                                            <Input
                                                type="number"
                                                className="h-8 w-24 bg-card"
                                                value={item.price}
                                                onChange={(e) => handleInputChange(item.id, 'price', e.target.value)}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell>{item.prevStock ?? 0}</TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className="h-8 w-20 bg-card"
                                            value={item.added || ''}
                                            onChange={(e) => handleInputChange(item.id, 'added', e.target.value)}
                                        />
                                    </TableCell>
                                    {showOpening && <TableCell>{opening}</TableCell>}
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className={`h-8 w-20 bg-card ${isLowStock && (item.sales ?? 0) > 0 ? 'bg-destructive/50' : ''}`}
                                            value={item.sales || ''}
                                            onChange={(e) => handleInputChange(item.id, 'sales', e.target.value)}
                                        />
                                    </TableCell>
                                    {showClosing && <TableCell className={isLowStock ? 'text-destructive font-bold' : ''}>{closing}</TableCell>}
                                </TableRow>
                            )
                        })}
                        </TableBody>
                    </Table>
                    )}
                </div>

                <div className="flex justify-end mt-6">
                    <Button size="lg" className="bg-green-600 hover:bg-green-700" onClick={handleSaveChanges} disabled={saving}>
                         {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    </main>
  );
}

    