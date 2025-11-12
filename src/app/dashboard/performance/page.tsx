
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { eachDayOfInterval, startOfDay, subMonths, subDays, format, isSameDay, parse, isValid } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Calendar as CalendarIcon, Filter, Loader2, Download, PackagePlus, MinusCircle, TrendingUp, ChevronsUpDown } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

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

    const [dateRangeOption, setDateRangeOption] = useState('30d');
    const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 29));
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    
    const [categoryFilter, setCategoryFilter] = useState('All Categories');
    const [productFilter, setProductFilter] = useState('All Products');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);

    usePageLoading(loading || inventoryLoading);
    
    const fetchPerformanceData = useCallback(async (range: {from?: Date, to?:Date}, category: string, product: string, sort: 'desc' | 'asc') => {
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
            fetchPerformanceData({from: fromDate, to: toDate}, categoryFilter, productFilter, sortOrder);
        }
    }, [masterInventory.length]);


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
        let newFromDate: Date | undefined = fromDate;
        let newToDate: Date | undefined = toDate;

        if (value === 'today') {
            newFromDate = now;
            newToDate = now;
        } else if (value === 'yesterday') {
            const yesterday = subDays(now, 1);
            newFromDate = yesterday;
            newToDate = yesterday;
        } else if (value.endsWith('d')) {
            const days = parseInt(value.replace('d', ''));
            newFromDate = subDays(now, days - 1);
            newToDate = now;
        } else if (value.endsWith('m')) {
            const months = parseInt(value.replace('m', ''));
            newFromDate = subMonths(now, months);
            newToDate = now;
        } else if (value === 'custom') {
            return;
        }
        
        setFromDate(newFromDate);
        setToDate(newToDate);
        fetchPerformanceData({from: newFromDate, to: newToDate}, categoryFilter, productFilter, sortOrder);
    };
    
    const handleApplyCustomDate = (date: Date | undefined, type: 'from' | 'to') => {
         let newFrom = fromDate;
         let newTo = toDate;
        
        if (type === 'from') {
            newFrom = date;
            setFromDate(date);
        } else {
            newTo = date;
            setToDate(date);
        }
        if (newFrom && newTo) {
             fetchPerformanceData({from: newFrom, to: newTo}, categoryFilter, productFilter, sortOrder);
        }
    };
    
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

        if (productFilter !== 'All Products') {
             const selectedProduct = masterInventory.find(p => p.id === productFilter);
             if (!selectedProduct) return;

             const history = await fetchSingleProductHistory({from: fromDate, to: toDate}, productFilter);
             
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
            doc.text(`Category: ${categoryFilter}`, 14, 38);

            doc.autoTable({
                startY: 45,
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

    if (inventoryLoading) {
        return null;
    }

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-2xl font-bold tracking-tight">Product Performance</h1>
                <div className="flex items-center gap-2">
                    <p className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">{formatDate(new Date(), 'dd/MM/yyyy')}</p>
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
                        <RadioGroup value={dateRangeOption} onValueChange={handleDateRangeOptionChange} className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="30d" id="30d" /><Label htmlFor="30d">Last 30 days</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="60d" id="60d" /><Label htmlFor="60d">Last 60 days</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="90d" id="90d" /><Label htmlFor="90d">Last 90 days</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="1m" id="1m" /><Label htmlFor="1m">Last month</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="3m" id="3m" /><Label htmlFor="3m">Last 3 months</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="custom" id="custom" /><Label htmlFor="custom">Custom date range</Label></div>
                        </RadioGroup>
                        {dateRangeOption === 'custom' && (
                            <div className="flex items-center gap-4">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-[180px] justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{fromDate ? formatDate(fromDate) : <span>From date</span>}</Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar captionLayout="dropdown-buttons" fromYear={2020} toYear={new Date().getFullYear()} selected={fromDate} onSelect={(d) => setFromDate(d)} onApply={(d) => { handleApplyCustomDate(d, 'from'); (document.activeElement as HTMLElement)?.blur(); }} onCancel={() => (document.activeElement as HTMLElement)?.blur()} initialFocus /></PopoverContent>
                                </Popover>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-[180px] justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{toDate ? formatDate(toDate) : <span>To date</span>}</Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0"><Calendar captionLayout="dropdown-buttons" fromYear={2020} toYear={new Date().getFullYear()} selected={toDate} onSelect={(d) => setToDate(d)} onApply={(d) => { handleApplyCustomDate(d, 'to'); (document.activeElement as HTMLElement)?.blur(); }} onCancel={() => (document.activeElement as HTMLElement)?.blur()} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                        )}
                    </div>
                     <div className="flex flex-col md:flex-row items-center gap-4 w-full flex-wrap">
                        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); fetchPerformanceData({from: fromDate, to: toDate}, v, productFilter, sortOrder); }}>
                            <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Select Category" /></SelectTrigger>
                            <SelectContent>{allCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={productFilter} onValueChange={(v) => { setProductFilter(v); fetchPerformanceData({from: fromDate, to: toDate}, categoryFilter, v, sortOrder); }} disabled={categoryFilter === 'All Categories'}>
                            <SelectTrigger className="w-full md:w-[220px]"><SelectValue placeholder="Select Product" /></SelectTrigger>
                            <SelectContent><SelectItem value="All Products">All Products</SelectItem>{filteredProductsForDropdown.map(p => (<SelectItem key={p.id} value={p.id}>{p.brand} ({p.size})</SelectItem>))}</SelectContent>
                        </Select>
                        <Select value={sortOrder} onValueChange={(v: 'desc' | 'asc') => { setSortOrder(v); fetchPerformanceData({from: fromDate, to: toDate}, categoryFilter, productFilter, v); }}>
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
