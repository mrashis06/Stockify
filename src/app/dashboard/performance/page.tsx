
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { eachDayOfInterval, startOfDay, subMonths, subDays, format, isSameDay, parse, isValid } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, Filter, Loader2, Download, PackagePlus, MinusCircle, TrendingUp, ChevronsUpDown, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useMediaQuery } from 'react-responsive';

import { usePageLoading } from '@/hooks/use-loading';
import { useDateFormat } from '@/hooks/use-date-format';
import { useInventory } from '@/hooks/use-inventory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

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


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type PerformanceData = {
    productId: string;
    brand: string;
    size: string;
    category: string;
    unitsSold: number;
};

type DailyRecord = {
    date: string;
    unitsSold: number;
    unitsAdded: number;
}

export default function PerformancePage() {
    const { inventory: masterInventory, loading: inventoryLoading } = useInventory();
    const { formatDate } = useDateFormat();
    const [loading, setLoading] = useState(true);
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });

    const [dateRangeOption, setDateRangeOption] = useState('today');
    const [fromDate, setFromDate] = useState<Date | undefined>(new Date());
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    
    const [isFromOpen, setIsFromOpen] = useState(false);
    const [isToOpen, setIsToOpen] = useState(false);

    const [selectedCategories, setSelectedCategories] = useState<string[]>(['All Categories']);
    const [selectedProducts, setSelectedProducts] = useState<string[]>(['All Products']);
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);

    usePageLoading(loading || inventoryLoading);
    
    const fetchPerformanceData = useCallback(async (range: {from?: Date, to?:Date}, categories: string[], products: string[], sort: 'desc' | 'asc') => {
        if (!range?.from) return;
        setLoading(true);

        const salesMap = new Map<string, { sold: number; added: number }>();
        const interval = { start: startOfDay(range.from), end: startOfDay(range.to || range.from) };
        const days = eachDayOfInterval(interval);

        try {
            for (const day of days) {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dailyDocRef = doc(db, 'dailyInventory', dateStr);
                const docSnap = await getDoc(dailyDocRef);
                if (docSnap.exists()) {
                    const dailyLog = docSnap.data();
                    for (const productId in dailyLog) {
                        const itemLog = dailyLog[productId];
                        const masterItemRef = masterInventory.find(i => i.id === productId);

                        const categoryMatch = categories.includes('All Categories') || (masterItemRef && categories.includes(masterItemRef.category));
                        if (!categoryMatch) continue;
                        
                        const productMatch = products.includes('All Products') || products.includes(productId);
                        if (!productMatch) continue;
                        
                        const current = salesMap.get(productId) || { sold: 0, added: 0 };
                        if (itemLog.sales) current.sold += itemLog.sales;
                        if (itemLog.added) current.added += itemLog.added;
                        salesMap.set(productId, current);
                    }
                }
            }
            
            const formattedData: PerformanceData[] = [];
            for (const [productId, data] of salesMap.entries()) {
                const masterItem = masterInventory.find(item => item.id === productId);
                if (masterItem) {
                    formattedData.push({
                        productId,
                        brand: masterItem.brand,
                        size: masterItem.size,
                        category: masterItem.category,
                        unitsSold: data.sold,
                    });
                }
            }
            const sortedData = formattedData.sort((a, b) => {
                return sort === 'desc' ? b.unitsSold - a.unitsSold : a.unitsSold - b.unitsSold;
            });
            setPerformanceData(sortedData);

        } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch performance data.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }

    }, [masterInventory]);

    useEffect(() => {
        if(masterInventory.length > 0) {
            fetchPerformanceData({from: fromDate, to: toDate}, selectedCategories, selectedProducts, sortOrder);
        }
    }, [masterInventory.length]);


    const allCategories = useMemo(() => {
        const cats = new Set(masterInventory.map(i => i.category).filter(Boolean));
        return ['All Categories', ...Array.from(cats).sort()];
    }, [masterInventory]);
    
    const filteredProductsForDropdown = useMemo(() => {
        if (selectedCategories.includes('All Categories')) return masterInventory;
        return masterInventory.filter(item => selectedCategories.includes(item.category));
    }, [masterInventory, selectedCategories]);
    
    useEffect(() => {
        // Reset product filter when category changes
        setSelectedProducts(['All Products']);
    }, [selectedCategories]);

    const handleDateRangeOptionChange = (value: string) => {
        setDateRangeOption(value);
        const now = new Date();
        let newFromDate: Date | undefined = fromDate;
        let newToDate: Date | undefined = toDate;

        if (value === 'today') {
            newFromDate = now;
            newToDate = now;
        } else if (value === 'yesterday') {
            const yesterday = subDays(now, 1);
            newFromDate = yesterday;
            newToDate = yesterday;
        } else if (value === '30d') {
            newFromDate = subDays(now, 29);
            newToDate = now;
        } else if (value === '60d') {
            newFromDate = subDays(now, 59);
            newToDate = now;
        } else if (value === '90d') {
            newFromDate = subDays(now, 89);
            newToDate = now;
        } else if (value === 'custom') {
            newFromDate = now;
            newToDate = now;
        }
        
        setFromDate(newFromDate);
        setToDate(newToDate);
        fetchPerformanceData({from: newFromDate, to: newToDate}, selectedCategories, selectedProducts, sortOrder);
    };
    
    const handleApplyCustomDate = (date: Date | undefined, type: 'from' | 'to') => {
         let newFrom = fromDate;
         let newTo = toDate;
        
        if (type === 'from') {
            newFrom = date;
            setFromDate(date);
            setIsFromOpen(false);
        } else {
            newTo = date;
            setToDate(date);
            setIsToOpen(false);
        }
        if (newFrom && newTo) {
             fetchPerformanceData({from: newFrom, to: newTo}, selectedCategories, selectedProducts, sortOrder);
        }
    };
    
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
    
    const handleProductSelect = (productId: string) => {
        setSelectedProducts(prev => {
            if (productId === 'All Products') {
                return ['All Products'];
            }
            const newSelection = prev.filter(p => p !== 'All Products');
            if (newSelection.includes(productId)) {
                const filtered = newSelection.filter(p => p !== productId);
                return filtered.length === 0 ? ['All Products'] : filtered;
            } else {
                return [...newSelection, productId];
            }
        });
    };


    useEffect(() => {
        fetchPerformanceData({from: fromDate, to: toDate}, selectedCategories, selectedProducts, sortOrder);
    }, [selectedCategories, selectedProducts, sortOrder, fromDate, toDate, fetchPerformanceData]);
    
    const fetchSingleProductHistory = useCallback(async (range: {from?: Date, to?: Date}, productId: string): Promise<DailyRecord[]> => {
        if (!range?.from || !productId) return [];
        
        const history: DailyRecord[] = [];
        const interval = { start: startOfDay(range.from), end: startOfDay(range.to || range.from) };
        const days = eachDayOfInterval(interval);
        
        for (const day of days) {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dailyDocRef = doc(db, 'dailyInventory', dateStr);
            const docSnap = await getDoc(dailyDocRef);
            if (docSnap.exists()) {
                const dailyLog = docSnap.data();
                if (dailyLog[productId] && (dailyLog[productId].sales > 0 || dailyLog[productId].added > 0)) {
                    history.push({
                        date: dateStr,
                        unitsSold: dailyLog[productId].sales || 0,
                        unitsAdded: dailyLog[productId].added || 0,
                    });
                }
            }
        }
        return history;
    }, []);

    const handleExportPDF = async () => {
        const doc = new jsPDF() as jsPDFWithAutoTable;
        const from = fromDate ? formatDate(fromDate) : 'N/A';
        const to = toDate ? formatDate(toDate) : 'N/A';

        // Add Shop Name Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("BHOLE BABA FL ON SHOP", doc.internal.pageSize.width / 2, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        if (selectedProducts.length === 1 && selectedProducts[0] !== 'All Products') {
             const selectedProduct = masterInventory.find(p => p.id === selectedProducts[0]);
             if (!selectedProduct) return;

             const history = await fetchSingleProductHistory({from: fromDate, to: toDate}, selectedProducts[0]);
             
             doc.setFontSize(14);
             doc.text(`Sales History for ${selectedProduct.brand} (${selectedProduct.size})`, 14, 25);
             doc.setFontSize(10);
             doc.text(`Period: ${from} to ${to}`, 14, 32);

             doc.autoTable({
                 startY: 40,
                 head: [['Date', 'Units Sold']],
                 body: history.map(item => [formatDate(item.date), item.unitsSold]),
                 foot: [[
                     'Total',
                     history.reduce((sum, item) => sum + item.unitsSold, 0),
                 ]],
                 headStyles: { fillColor: [40, 40, 40] },
                 footStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold' },
                 showFoot: 'lastPage'
             });

             doc.save(`history_${selectedProduct.brand}_${selectedProduct.size}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        
        } else {
            // Original summary export logic
            doc.setFontSize(14);
            doc.text('Product Performance Report', 14, 25);
            doc.setFontSize(10);
            doc.text(`Period: ${from} to ${to}`, 14, 32);
            
            const productText = selectedProducts.includes('All Products') 
                ? 'All Products' 
                : `${selectedProducts.length} selected`;
            doc.text(`Categories: ${selectedCategories.join(', ')}`, 14, 38);
            doc.text(`Products: ${productText}`, 14, 44);


            doc.autoTable({
                startY: 50,
                head: [['Brand', 'Size', 'Category', 'Units Sold']],
                body: performanceData.map(item => [item.brand, item.size, item.category, item.unitsSold]),
                foot: [[
                    'Total', '', '', 
                    performanceData.reduce((sum, item) => sum + item.unitsSold, 0),
                ]],
                headStyles: { fillColor: [40, 40, 40] },
                footStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold' },
                showFoot: 'lastPage'
            });
            doc.save(`performance_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        }
        
        toast({
            title: "Export Successful",
            description: "Your Performance Report has been downloaded.",
        });
    };

    const headerDate = useMemo(() => {
        if (!fromDate) return '';
        const start = formatDate(fromDate, 'dd-MMM-yyyy');
        if (!toDate || isSameDay(fromDate, toDate)) {
            return start;
        }
        const end = formatDate(toDate, 'dd-MMM-yyyy');
        return `${start} to ${end}`;
    }, [fromDate, toDate, formatDate]);

    if (inventoryLoading) {
        return null;
    }

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Product Performance</h1>
                 <div className="flex items-center gap-2">
                    <p className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">{headerDate}</p>
                    <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">&bull;</span>
                    <RealTimeClock />
                </div>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-6">
                        <RadioGroup value={dateRangeOption} onValueChange={handleDateRangeOptionChange} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 flex-wrap">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="today" id="today" /><Label htmlFor="today">Today</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="yesterday" id="yesterday" /><Label htmlFor="yesterday">Yesterday</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="30d" id="30d" /><Label htmlFor="30d">Last 30 days</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="60d" id="60d" /><Label htmlFor="60d">Last 60 days</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="90d" id="90d" /><Label htmlFor="90d">Last 90 days</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="custom" id="custom" /><Label htmlFor="custom">Custom date range</Label></div>
                        </RadioGroup>
                        {dateRangeOption === 'custom' && (
                            <div className="flex items-center gap-4">
                                <Popover open={isFromOpen} onOpenChange={setIsFromOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-[180px] justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{fromDate ? formatDate(fromDate) : <span>From date</span>}</Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar captionLayout="dropdown-buttons" fromYear={2020} toYear={new Date().getFullYear()} selected={fromDate} onSelect={setFromDate} onApply={() => handleApplyCustomDate(fromDate, 'from')} onCancel={() => setIsFromOpen(false)} initialFocus /></PopoverContent>
                                </Popover>
                                <Popover open={isToOpen} onOpenChange={setIsToOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-[180px] justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{toDate ? formatDate(toDate) : <span>To date</span>}</Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar captionLayout="dropdown-buttons" fromYear={2020} toYear={new Date().getFullYear()} selected={toDate} onSelect={setToDate} onApply={() => handleApplyCustomDate(toDate, 'to')} onCancel={() => setIsToOpen(false)} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                        )}
                    </div>
                     <div className="flex flex-col md:flex-row items-center gap-4 w-full flex-wrap">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full md:w-[220px] justify-between">
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

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full md:w-[220px] justify-between">
                                    <span className="truncate">
                                         {selectedProducts.length === 1 && selectedProducts[0] !== 'All Products' 
                                            ? (masterInventory.find(p => p.id === selectedProducts[0])?.brand || '')
                                            : selectedProducts.includes('All Products')
                                            ? 'All Products'
                                            : `${selectedProducts.length} products selected`}
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64">
                                <DropdownMenuLabel>Filter by Product</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <ScrollArea className="h-64">
                                <DropdownMenuCheckboxItem
                                    checked={selectedProducts.includes('All Products')}
                                    onSelect={(e) => e.preventDefault()}
                                    onCheckedChange={() => handleProductSelect('All Products')}
                                >
                                    All Products
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuSeparator />
                                {filteredProductsForDropdown.map(p => (
                                    <DropdownMenuCheckboxItem
                                        key={p.id}
                                        checked={selectedProducts.includes(p.id)}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => handleProductSelect(p.id)}
                                    >
                                        {p.brand} ({p.size})
                                    </DropdownMenuCheckboxItem>
                                ))}
                                </ScrollArea>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        
                        <Select value={sortOrder} onValueChange={(v: 'desc' | 'asc') => setSortOrder(v)}>
                            <SelectTrigger className="w-full md:w-[220px]"><ChevronsUpDown className="mr-2 h-4 w-4" /><SelectValue placeholder="Sort by..." /></SelectTrigger>
                            <SelectContent><SelectItem value="desc">Highest Units Sold</SelectItem><SelectItem value="asc">Lowest Units Sold</SelectItem></SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Performance Results</CardTitle>
                        <CardDescription>Aggregated sales data for the selected period and filters.</CardDescription>
                    </div>
                     <Button onClick={handleExportPDF} disabled={loading || performanceData.length === 0} variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export PDF
                    </Button>
                </CardHeader>
                <CardContent>
                     {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                     ) : isMobile ? (
                        <div className="space-y-3">
                            {performanceData.length > 0 ? (
                                performanceData.map(item => (
                                    <Card key={item.productId} className="p-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <div>
                                                <h3 className="font-bold">{item.brand}</h3>
                                                <p className="text-sm text-muted-foreground">{item.size} &bull; {item.category}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-lg text-destructive">{item.unitsSold}</p>
                                                <p className="text-xs text-muted-foreground">Units Sold</p>
                                            </div>
                                        </div>
                                    </Card>
                                ))
                            ) : (
                                <p className="text-center text-muted-foreground py-8">No data found for the selected filters.</p>
                            )}
                             {performanceData.length > 1 && (
                                <Card className="mt-4 p-4 font-bold bg-muted/50">
                                    <div className="flex justify-between items-center text-base">
                                        <span>Grand Total Units Sold:</span>
                                        <span className="text-destructive">{performanceData.reduce((sum, item) => sum + item.unitsSold, 0)}</span>
                                    </div>
                                </Card>
                             )}
                        </div>
                     ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Brand</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead className="text-right text-destructive">Units Sold</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {performanceData.length > 0 ? (
                                        performanceData.map(item => (
                                            <TableRow key={item.productId}>
                                                <TableCell className="font-medium">{item.brand}</TableCell>
                                                <TableCell>{item.size}</TableCell>
                                                <TableCell>{item.category}</TableCell>
                                                <TableCell className="text-right font-bold text-destructive">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <MinusCircle className="h-4 w-4" />
                                                        {item.unitsSold}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                No data found for the selected filters.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                                {performanceData.length > 1 && (
                                    <TableFooter>
                                        <TableRow className="bg-muted/50">
                                            <TableCell colSpan={3} className="font-bold text-right text-base">Grand Totals</TableCell>
                                            <TableCell className="text-right font-extrabold text-destructive text-base">
                                                {performanceData.reduce((sum, item) => sum + item.unitsSold, 0)}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                )}
                            </Table>
                        </div>
                     )}
                </CardContent>
            </Card>

        </div>
    );
}
