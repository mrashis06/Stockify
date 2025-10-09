

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { eachDayOfInterval, startOfDay, subMonths, subDays, format, isSameDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, Filter, Loader2, Download, PackagePlus, MinusCircle, TrendingUp } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { usePageLoading } from '@/hooks/use-loading';
import { useDateFormat } from '@/hooks/use-date-format';
import { useInventory } from '@/hooks/use-inventory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type PerformanceData = {
    productId: string;
    brand: string;
    size: string;
    category: string;
    unitsSold: number;
    unitsAdded: number;
};

type DailyRecord = {
    date: string;
    unitsSold: number;
    unitsAdded: number;
}

const dateRangeOptions = [
    { label: 'Last 30 Days', value: '30d' },
    { label: 'Last 3 Months', value: '3m' },
    { label: 'Last 6 Months', value: '6m' },
    { label: 'Custom Range', value: 'custom' },
];

export default function PerformancePage() {
    const { inventory: masterInventory, loading: inventoryLoading } = useInventory();
    const { formatDate } = useDateFormat();
    const [loading, setLoading] = useState(true);

    const [dateRangeOption, setDateRangeOption] = useState('30d');
    const [date, setDate] = useState<DateRange | undefined>({
        from: subDays(new Date(), 29),
        to: new Date(),
    });
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [productFilter, setProductFilter] = useState('All Products');
    const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);

    usePageLoading(loading || inventoryLoading);
    
    const allCategories = useMemo(() => {
        const cats = new Set(masterInventory.map(i => i.category).filter(Boolean));
        return ['All Categories', ...Array.from(cats).sort()];
    }, [masterInventory]);
    
    const filteredProductsForDropdown = useMemo(() => {
        if (categoryFilter === 'All Categories') return [];
        return masterInventory.filter(item => item.category === categoryFilter);
    }, [masterInventory, categoryFilter]);
    
    useEffect(() => {
        setProductFilter('All Products');
    }, [categoryFilter]);

    const handleDateRangeOptionChange = (value: string) => {
        setDateRangeOption(value);
        const now = new Date();
        if (value === '30d') {
            setDate({ from: subDays(now, 29), to: now });
        } else if (value === '3m') {
            setDate({ from: subMonths(now, 3), to: now });
        } else if (value === '6m') {
            setDate({ from: subMonths(now, 6), to: now });
        } else {
            // For 'custom', we let the user pick, don't change the date here
        }
    };

    const handleDateSelect = (range: DateRange | undefined) => {
        setDateRangeOption('custom');
        setDate(range);
    };
    
    const fetchPerformanceData = useCallback(async (range: DateRange | undefined, category: string, product: string) => {
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

                        if (category !== 'All Categories' && masterItemRef?.category !== category) continue;
                        if (product !== 'All Products' && productId !== product) continue;
                        
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
                        unitsAdded: data.added,
                    });
                }
            }
            setPerformanceData(formattedData.sort((a, b) => a.brand.localeCompare(b.brand)));

        } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch performance data.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }

    }, [masterInventory]);
    
    useEffect(() => {
        if (masterInventory.length > 0) {
            fetchPerformanceData(date, categoryFilter, productFilter);
        }
    }, [masterInventory, date, categoryFilter, productFilter, fetchPerformanceData]);
    
    const fetchSingleProductHistory = useCallback(async (range: DateRange | undefined, productId: string): Promise<DailyRecord[]> => {
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
        const from = date?.from ? formatDate(date.from) : 'N/A';
        const to = date?.to ? formatDate(date.to) : 'N/A';

        if (productFilter !== 'All Products') {
             const selectedProduct = masterInventory.find(p => p.id === productFilter);
             if (!selectedProduct) return;

             const history = await fetchSingleProductHistory(date, productFilter);
             
             doc.setFontSize(16);
             doc.text(`Sales History for ${selectedProduct.brand} (${selectedProduct.size})`, 14, 15);
             doc.setFontSize(10);
             doc.text(`Period: ${from} to ${to}`, 14, 22);

             doc.autoTable({
                 startY: 30,
                 head: [['Date', 'Units Sold']],
                 body: history.map(item => [formatDate(item.date), item.unitsSold]),
                 foot: [[
                     'Total',
                     history.reduce((sum, item) => sum + item.unitsSold, 0),
                 ]],
                 headStyles: { fillColor: [40, 40, 40] },
                 footStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold' }
             });

             doc.save(`history_${selectedProduct.brand}_${selectedProduct.size}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        
        } else {
            // Original summary export logic
            doc.setFontSize(16);
            doc.text('Product Performance Report', 14, 15);
            doc.setFontSize(10);
            doc.text(`Period: ${from} to ${to}`, 14, 22);
            doc.text(`Category: ${categoryFilter}`, 14, 28);

            doc.autoTable({
                startY: 35,
                head: [['Brand', 'Size', 'Category', 'Units Sold']],
                body: performanceData.map(item => [item.brand, item.size, item.category, item.unitsSold]),
                foot: [[
                    'Total', '', '', 
                    performanceData.reduce((sum, item) => sum + item.unitsSold, 0),
                ]],
                headStyles: { fillColor: [40, 40, 40] },
                footStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold' }
            });
            doc.save(`performance_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        }
    };

    if (loading || inventoryLoading) {
        return null;
    }

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Product Performance</h1>
                <p className="text-muted-foreground">Analyze product sales over time.</p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full flex-wrap">
                    <Select value={dateRangeOption} onValueChange={handleDateRangeOptionChange}>
                         <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="Select Date Range" />
                        </SelectTrigger>
                        <SelectContent>
                            {dateRangeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full md:w-auto justify-start text-left font-normal", !date && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (date.to ? (<>{formatDate(date.from)} - {formatDate(date.to)}</>) : formatDate(date.from)) : <span>Pick a date range</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={handleDateSelect} numberOfMonths={1} disabled={{ after: new Date() }} />
                        </PopoverContent>
                    </Popover>
                    
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                             {allCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={productFilter} onValueChange={setProductFilter} disabled={categoryFilter === 'All Categories'}>
                        <SelectTrigger className="w-full md:w-[220px]">
                            <SelectValue placeholder="Select Product" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All Products">All Products</SelectItem>
                            {filteredProductsForDropdown.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.brand} ({p.size})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
                </CardContent>
            </Card>

        </div>
    );
}
