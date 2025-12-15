
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMediaQuery } from 'react-responsive';
import { IndianRupee, Plus, Search, Trash2, ListFilter, Loader2, Pencil, LogOut, GlassWater, Warehouse, Archive, ChevronDown, ChevronUp } from 'lucide-react';
import { subDays } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useInventory, InventoryItem, DailyOnBarSale } from '@/hooks/use-inventory';
import { useEndOfDay } from '@/hooks/use-end-of-day';
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
import { Separator } from '@/components/ui/separator';
import { useDateFormat } from '@/hooks/use-date-format';
import { Checkbox } from '@/components/ui/checkbox';
import SelectionActionBar from '@/components/dashboard/selection-action-bar';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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


export default function InventoryPage() {
    const { formatDate } = useDateFormat();
    const searchParams = useSearchParams();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
    
    const { 
        inventory,
        dailyOnBarSales,
        addBrand,
        deleteBrand: deleteProduct,
        updateBrand,
        updateItemField,
        totalOnBarSales,
        offCounterNeedsEOD,
        resetOffCounterEOD,
        initListeners,
        selectedDate,
        setDate,
        dateChangeConfirmation,
        confirmDateChange,
        cancelDateChange,
    } = useInventory();

     useEffect(() => {
        if (!selectedDate) return;
        const unsub = initListeners(selectedDate);
        return () => unsub();
    }, [selectedDate, initListeners]);
    
    const { isEndingDay, endOfDayProcess } = useEndOfDay();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['All Categories']);
    const [isAddBrandOpen, setIsAddBrandOpen] = useState(false);
    const [isEditBrandOpen, setIsEditBrandOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState<InventoryItem | null>(null);
    const [showOpening, setShowOpening] = useState(true);
    const [showClosing, setShowClosing] = useState(true);
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isEndOfDayDialogOpen, setIsEndOfDayDialogOpen] = useState(false);
    const [expandedMobileRow, setExpandedMobileRow] = useState<string | null>(null);
    const { toast } = useToast();
    
    useEffect(() => {
        const category = searchParams.get('category');
        if (category) {
            setSelectedCategories([decodeURIComponent(category)]);
        }
    }, [searchParams]);

    const handleDateChange = (value: 'today' | 'yesterday') => {
        const newDate = value === 'today' ? new Date() : subDays(new Date(), 1);
        setDate(newDate);
    };

    const handleAddBrand = async (newItemData: Omit<InventoryItem, 'id' | 'sales' | 'opening' | 'closing' | 'stockInGodown'> & {initialStock: number}) => {
        try {
            await addBrand(newItemData);
            toast({ title: 'Brand Added', description: `${newItemData.brand} (${newItemData.size}) created.` });
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
            const item = inventory.find(i => i.id === id);
            await updateBrand(id, data);
            toast({ title: 'Brand Updated', description: `Details for ${item?.brand} updated.` });
        } catch (error) {
            console.error('Error updating brand:', error);
            toast({ title: 'Error', description: 'Failed to update brand.', variant: 'destructive' });
        }
    };
    
    const handleFieldChange = async (id: string, field: 'added' | 'sales' | 'price' | 'size', value: string) => {
        const originalItem = inventory.find(item => item.id === id);
        if (!originalItem) return;

        let processedValue: number | string = value;
        if (field === 'added' || field === 'sales' || field === 'price') {
             processedValue = Number(value);
             if (isNaN(processedValue) || processedValue < 0) {
                 toast({ title: 'Invalid Input', description: 'Please enter a valid non-negative number.', variant: 'destructive'});
                 return;
             }
        }
       
        try {
            await updateItemField(id, field, processedValue);
            let description = '';
            switch(field) {
                case 'sales':
                    description = `Sold ${processedValue} units of ${originalItem.brand} (${originalItem.size}).`;
                    break;
                case 'added':
                    description = `Added ${processedValue} units of ${originalItem.brand} (${originalItem.size}) to shop.`;
                    break;
                case 'price':
                    description = `Price for ${originalItem.brand} (${originalItem.size}) updated to ₹${processedValue}.`;
                    break;
                default:
                    description = `Item ${field} updated.`;
            }
            toast({ title: 'Update Successful', description });
        } catch (error) {
            console.error(`Error updating ${field}:`, error);
            const errorMessage = (error as Error).message || `Failed to update ${field}.`;
            toast({ title: 'Error', description: errorMessage, variant: 'destructive'});
        }
    };


    const handleDeleteSelected = async () => {
        const numSelected = selectedRows.size;
        try {
            await Promise.all(Array.from(selectedRows).map(id => deleteProduct(id)));
            toast({ title: 'Success', description: `${numSelected} brand(s) have been removed.` });
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
            await endOfDayProcess(processedInventory);
            resetOffCounterEOD(); 
            toast({
                title: 'End of Day Processed',
                description: "Today's final stock has been saved as tomorrow's opening stock."
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
    
    const toggleMobileRowExpansion = (itemId: string) => {
        setExpandedMobileRow(prev => prev === itemId ? null : itemId);
    };
    
    const processedInventory = useMemo(() => {
        return inventory.map(item => {
            const added = Number(item.added || 0);
            const sales = Number(item.sales || 0);
            const prevStock = Number(item.prevStock || 0);

            const opening = prevStock + added;
            const closing = opening - sales;
            
            return {
                ...item,
                added,
                sales,
                prevStock,
                opening,
                closing,
            };
        });
    }, [inventory]);

    const recentlyAddedIds = useMemo(() => {
        return new Set(inventory.filter(item => item.id.startsWith('manual_') && (item.added > 0 || item.prevStock > 0)).map(item => item.id));
    }, [inventory]);

    const filteredInventory = useMemo(() => {
        return processedInventory.filter(item => {
            const hasActivity = (item.opening ?? 0) > 0 || (item.closing ?? 0) > 0 || (item.sales ?? 0) > 0;
            const isRecentlyAdded = recentlyAddedIds.has(item.id);
            if (!hasActivity && !isRecentlyAdded) return false;

            const matchesSearch = item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategories.includes('All Categories') || selectedCategories.includes(item.category);
            return matchesSearch && matchesCategory;
        });
    }, [processedInventory, searchQuery, selectedCategories, recentlyAddedIds]);

    const allCategories = useMemo(() => {
        const cats = new Set(inventory.filter(i => (Number(i.prevStock || 0) + Number(i.added || 0)) > 0).map(i => i.category).filter(Boolean));
        return ['All Categories', ...Array.from(cats).sort()];
    }, [inventory]);

    const { totalOpening, totalAdded, totalSalesUnits, totalClosing } = useMemo(() => {
        return filteredInventory.reduce((acc, item) => {
            acc.totalOpening += Number(item.opening || 0);
            acc.totalAdded += Number(item.added || 0);
            acc.totalSalesUnits += Number(item.sales || 0);
            acc.totalClosing += Number(item.closing || 0);
            return acc;
        }, { totalOpening: 0, totalAdded: 0, totalSalesUnits: 0, totalClosing: 0 });
    }, [filteredInventory]);

    const totalOffCounterAmount = useMemo(() => {
        return filteredInventory.reduce((total, item) => total + (Number(item.sales) || 0) * (Number(item.price) || 0), 0);
    }, [filteredInventory]);
    
    const grandTotalSales = totalOffCounterAmount + totalOnBarSales;
    
    const handleCategorySelect = (category: string) => {
        setSelectedCategories(prev => {
            if (category === 'All Categories') {
                return ['All Categories'];
            }
            const newSelection = prev.filter(c => c !== 'All Categories');
            if (newSelection.includes(category)) {
                const filtered = newSelection.filter(c => c !== category);
                return filtered.length === 0 ? ['All Categories'] : filtered;
            } else {
                return [...newSelection, category];
            }
        });
    };

  const dateOption = useMemo(() => {
    if (!selectedDate) return 'today';
    const today = new Date();
    return today.toDateString() === selectedDate.toDateString() ? 'today' : 'yesterday';
  }, [selectedDate]);


  return (
    <main className={cn("flex-1 p-4 md:p-8", selectedRows.size > 0 && "pb-24")}>
        {selectedRows.size > 0 && (
            <SelectionActionBar
                count={selectedRows.size}
                onClear={() => setSelectedRows(new Set())}
            >
                <Button onClick={() => setIsDeleteDialogOpen(true)} size="sm" variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove ({selectedRows.size})
                </Button>
            </SelectionActionBar>
        )}
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
                        This will finalize today's numbers and set the opening stock for tomorrow. You can still edit today's sales after running this. Are you sure you want to continue?
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
        <AlertDialog open={!!dateChangeConfirmation} onOpenChange={(open) => !open && cancelDateChange()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Date Change</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have already recorded sales for yesterday. Are you sure you want to go back and modify them?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={cancelDateChange}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDateChange}>Continue</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Off-Counter Inventory</h1>
            <div className="flex items-center gap-2">
                <p className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">{formatDate(selectedDate, 'dd-MMM-yyyy, EEEE')}</p>
                <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">&bull;</span>
                <RealTimeClock />
            </div>
        </div>
        
        <div className="md:hidden grid grid-cols-2 gap-2 mb-6">
            <Button variant="outline" asChild>
                <Link href="/dashboard/godown">
                    <Archive className="mr-2 h-4 w-4" />
                    Godown
                </Link>
            </Button>
            <Button variant="outline" asChild>
                <Link href="/dashboard/onbar">
                    <GlassWater className="mr-2 h-4 w-4" />
                    On-Bar
                </Link>
            </Button>
        </div>
        
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full sm:w-[200px] justify-between">
                                    <span className="truncate">
                                        {selectedCategories.length === 1 && selectedCategories[0] !== 'All Categories' 
                                            ? selectedCategories[0] 
                                            : selectedCategories.includes('All Categories')
                                            ? 'All Categories'
                                            : `${selectedCategories.length} selected`}
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {allCategories.map(cat => (
                                    <DropdownMenuCheckboxItem
                                        key={cat}
                                        checked={selectedCategories.includes(cat)}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => handleCategorySelect(cat)}
                                    >
                                        {cat}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        {!isMobile && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full sm:w-auto">
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
                        )}
                        <Button variant="outline" className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto" onClick={() => setIsAddBrandOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add Brand
                        </Button>
                    </div>
                </div>
                 <div className="flex justify-end mt-4">
                     <Button 
                        onClick={() => setIsEndOfDayDialogOpen(true)} 
                        variant="outline" 
                        className={cn("bg-blue-600 hover:bg-blue-700 text-white", offCounterNeedsEOD && "animate-subtle-glow")}
                        disabled={isEndingDay}>
                        <LogOut className="mr-2 h-4 w-4" /> End of Day
                    </Button>
                </div>

                <div className="mt-4">
                    {isMobile ? (
                        <div className="space-y-3">
                            {filteredInventory.length > 0 ? (
                                filteredInventory.map(item => {
                                    const isLowStock = (item.closing ?? 0) < 10;
                                    const amount = (item.sales ?? 0) * item.price;
                                    const isExpanded = expandedMobileRow === item.id;

                                    return (
                                        <Card key={item.id} className={cn("p-4 space-y-4", isLowStock && 'bg-destructive/10', selectedRows.has(item.id) && 'ring-2 ring-primary')}>
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3 flex-1">
                                                    <Checkbox
                                                        id={`select-${item.id}`}
                                                        checked={selectedRows.has(item.id)}
                                                        onCheckedChange={() => handleRowSelect(item.id)}
                                                        className="mt-1"
                                                    />
                                                    <div>
                                                        <div className="flex items-center gap-1">
                                                            <h3 className="font-bold leading-tight">{item.brand}</h3>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleEditBrand(item)}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">{item.size}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="font-bold text-lg">{item.closing}</p>
                                                    <p className="text-xs text-muted-foreground">Closing</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between text-center border-y py-3">
                                                 <div className="flex-1 text-left">
                                                     <p className="font-bold text-base text-primary flex items-center">
                                                      <IndianRupee className="h-4 w-4" />
                                                      {amount.toLocaleString('en-IN')}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">Amount</p>
                                                 </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <Label htmlFor={`added-${item.id}`} className="text-xs">Added</Label>
                                                    <Input
                                                        id={`added-${item.id}`}
                                                        key={`${item.id}-added-${item.added}`}
                                                        type="number"
                                                        className="h-9"
                                                        defaultValue={item.added || ''}
                                                        placeholder="0"
                                                        onBlur={(e) => handleFieldChange(item.id, 'added', e.target.value || '0')}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                    />
                                                </div>
                                                 <div className="space-y-1">
                                                    <Label htmlFor={`sales-${item.id}`} className="text-xs">Sales</Label>
                                                    <Input
                                                        id={`sales-${item.id}`}
                                                        key={`${item.id}-sales-${item.sales}`}
                                                        type="number"
                                                        className="h-9"
                                                        defaultValue={item.sales || ''}
                                                        placeholder="0"
                                                        onBlur={(e) => handleFieldChange(item.id, 'sales', e.target.value || '0')}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                    />
                                                </div>
                                            </div>
                                             <button onClick={() => toggleMobileRowExpansion(item.id)} className="w-full text-sm text-muted-foreground flex items-center justify-center pt-2">
                                                 {isExpanded ? 'Hide' : 'Show'} Details {isExpanded ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                                             </button>

                                             {isExpanded && (
                                                <div className="border-t pt-4 mt-4 space-y-2 text-sm">
                                                    <div className="flex justify-between"><span>Price:</span> <span className="font-medium">₹{item.price}</span></div>
                                                    <div className="flex justify-between"><span>Prev. Stock:</span> <span>{item.prevStock ?? 0}</span></div>
                                                    <div className="flex justify-between"><span>Opening:</span> <span>{item.opening}</span></div>
                                                </div>
                                             )}
                                        </Card>
                                    )
                                })
                            ) : (
                                <div className="h-24 text-center flex items-center justify-center text-muted-foreground">
                                    No stock found in the shop.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
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
                                {filteredInventory.length > 0 ? (
                                    filteredInventory.map(item => {
                                        const isLowStock = (item.closing ?? 0) < 10;
                                        const amount = (item.sales ?? 0) * item.price;

                                        return (
                                            <TableRow 
                                                key={item.id} 
                                                className={cn(isLowStock && 'bg-destructive/10 hover:bg-destructive/20')}
                                                data-state={selectedRows.has(item.id) ? "selected" : ""}
                                            >
                                                <TableCell className="text-center">
                                                    <Checkbox
                                                        checked={selectedRows.has(item.id)}
                                                        onCheckedChange={() => handleRowSelect(item.id)}
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
                                                            key={`${item.id}-price`}
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
                                                        key={`${item.id}-added-${item.added}`}
                                                        type="number"
                                                        className="h-8 w-20 bg-card"
                                                        defaultValue={item.added || ''}
                                                        placeholder="0"
                                                        onBlur={(e) => handleFieldChange(item.id, 'added', e.target.value || '0')}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                    />
                                                </TableCell>
                                                {showOpening && <TableCell>{item.opening}</TableCell>}
                                                <TableCell>
                                                    <Input
                                                        key={`${item.id}-sales-${item.sales}`}
                                                        type="number"
                                                        className={`h-8 w-20 bg-card ${isLowStock && (item.sales ?? 0) > 0 ? 'bg-destructive/50' : ''}`}
                                                        defaultValue={item.sales || ''}
                                                        placeholder="0"
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
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">
                                            No stock found in the shop. Transfer items from your Godown to get started.
                                        </TableCell>
                                    </TableRow>
                                )}
                                </TableBody>
                                <TableFooter>
                                    <TableRow className="bg-muted/50 font-medium">
                                        <TableCell colSpan={4} className="text-right">Off-Counter Totals</TableCell>
                                        <TableCell className="font-bold">{filteredInventory.reduce((sum, item) => sum + Number(item.prevStock || 0), 0)}</TableCell>
                                        <TableCell className="font-bold">{totalAdded}</TableCell>
                                        {showOpening && <TableCell className="font-bold">{totalOpening}</TableCell>}
                                        <TableCell className="font-bold">{totalSalesUnits}</TableCell>
                                        {showClosing && <TableCell className="font-bold">{totalClosing}</TableCell>}
                                        <TableCell className="font-bold">
                                            <div className="flex items-center">
                                                <IndianRupee className="h-4 w-4 mr-1 shrink-0" />
                                                {totalOffCounterAmount.toLocaleString('en-IN')}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    )}
                </div>

                {dailyOnBarSales.length > 0 && (
                    <div className="mt-8">
                        <Separator />
                        <Card className="mt-8 border-dashed bg-muted/30">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <GlassWater className="h-5 w-5 text-primary" /> Today's On-Bar Sales
                                </CardTitle>
                                <CardDescription>Summary of all items sold from the On-Bar inventory today.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Brand</TableHead>
                                            <TableHead>Units / Volume Sold</TableHead>
                                            <TableHead className="text-right">Sales Value</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dailyOnBarSales.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.brand} ({item.size})</TableCell>
                                                <TableCell>{item.salesVolume} {item.category === 'Beer' ? 'units' : 'ml'}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end">
                                                        <IndianRupee className="h-4 w-4 mr-1 shrink-0" />
                                                        {item.salesValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow className="bg-muted/50 font-medium">
                                            <TableCell colSpan={2} className="text-right font-bold">Total On-Bar Sales</TableCell>
                                            <TableCell className="text-right font-bold">
                                                <div className="flex items-center justify-end">
                                                    <IndianRupee className="h-4 w-4 mr-1 shrink-0" />
                                                    {totalOnBarSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </CardContent>
                        </Card>
                        <Separator className="my-8" />
                    </div>
                )}
                
                <div className="mt-6 flex justify-end">
                    <div className="min-w-[300px] text-right">
                        <div className="flex justify-between items-center py-2">
                            <p className="font-medium">Total Off-Counter Sales:</p>
                             <p className="font-semibold flex items-center">
                                <IndianRupee className="h-4 w-4 mr-1 shrink-0" />
                                {totalOffCounterAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b">
                            <p className="font-medium">Total On-Bar Sales:</p>
                             <p className="font-semibold flex items-center">
                                <IndianRupee className="h-4 w-4 mr-1 shrink-0" />
                                {totalOnBarSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                         <div className="flex justify-between items-center pt-4">
                            <p className="text-xl font-extrabold text-primary">Grand Total Sales:</p>
                             <p className="text-xl font-extrabold text-primary flex items-center">
                                <IndianRupee className="h-6 w-6 mr-1 shrink-0" />
                                {grandTotalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>

            </CardContent>
        </Card>
    </main>
  );
}
