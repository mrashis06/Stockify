
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { eachDayOfInterval, isSameDay, parse, startOfDay, parseISO, isValid, format, subDays } from 'date-fns';
import { Download, Filter, Loader2, FileSpreadsheet, IndianRupee, GlassWater, Package, Combine } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useSearchParams } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { toast } from '@/hooks/use-toast';
import { usePageLoading } from '@/hooks/use-loading';
import { useDateFormat } from '@/hooks/use-date-format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInventory, InventoryItem } from '@/hooks/use-inventory';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type OffCounterLog = { brand: string; size: string; sales: number; price: number; category: string };
type OnBarLog = { brand: string; size: string; category: string; salesVolume: number; salesValue: number; price?: number };

type DailyLog = { [itemId: string]: OffCounterLog | OnBarLog };

type ReportDataEntry = {
    date: string;
    log: DailyLog;
}

type SoldItem = {
    productId: string;
    brand: string;
    size: string;
    category: string;
    price: number;
    unitsSold: number;
    totalAmount: number;
};

type OnBarSoldItem = {
    productId: string;
    brand: string;
    size: string;
    category: string;
    unitsSold: number; // Volume in ml or units for beer
    totalAmount: number;
}

const dateRangeOptions = [
    { label: 'Today', value: 'today' },
    { label: 'Last 30 Days', value: '30d' },
    { label: 'Last 60 Days', value: '60d' },
    { label: 'Last 90 Days', value: '90d' },
    { label: 'Custom Range', value: 'custom' },
];


export default function ReportsPage() {
    const { formatDate, dateFormat } = useDateFormat();
    const searchParams = useSearchParams();
    const { inventory: masterInventory } = useInventory();
    const [dateRangeOption, setDateRangeOption] = useState('today');

    const [date, setDate] = useState<DateRange | undefined>(() => {
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        if (fromParam) {
            const fromDate = parseISO(fromParam);
            if (isValid(fromDate)) {
                const toDate = toParam ? parseISO(toParam) : fromDate;
                setDateRangeOption('custom');
                return {
                    from: fromDate,
                    to: isValid(toDate) ? toDate : fromDate
                }
            }
        }
        return { from: new Date(), to: new Date() };
    });
    
    const [dateInputs, setDateInputs] = useState<{ from: string; to: string }>({ from: '', to: '' });

    const [reportType, setReportType] = useState<'offcounter' | 'onbar' | 'both'>('both');
    const [reportData, setReportData] = useState<ReportDataEntry[]>([]);
    const [loading, setLoading] = useState(true);

    usePageLoading(loading);
    
    useEffect(() => {
        if (date?.from) setDateInputs(prev => ({...prev, from: formatDate(date.from)}));
        if (date?.to) setDateInputs(prev => ({...prev, to: formatDate(date.to)}));
    }, [date, formatDate]);


    const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'from' | 'to') => {
        setDateInputs(prev => ({ ...prev, [field]: e.target.value }));
    };

    const handleDateInputBlur = (field: 'from' | 'to') => {
        const dateStr = dateInputs[field];
        if (!dateStr) return; // Ignore empty input
        
        const parsedDate = parse(dateStr, dateFormat, new Date());
        if (isValid(parsedDate)) {
            setDate(prev => ({ ...prev, [field]: parsedDate }));
             setDateRangeOption('custom');
        } else {
            toast({ title: "Invalid Date", description: `The date format for '${field}' is not correct. Please use ${dateFormat}.`, variant: "destructive" });
        }
    };
    
    const handleDateRangeOptionChange = (value: string) => {
        setDateRangeOption(value);
        const now = new Date();
        if (value === 'today') {
            setDate({ from: now, to: now });
        } else if (value === '30d') {
            setDate({ from: subDays(now, 29), to: now });
        } else if (value === '60d') {
            setDate({ from: subDays(now, 59), to: now });
        } else if (value === '90d') {
            setDate({ from: subDays(now, 89), to: now });
        }
    };

    const fetchReportData = useCallback(async (range: DateRange | undefined) => {
        if (!range?.from) {
            toast({ title: "Error", description: "Please select a start date.", variant: "destructive" });
            setLoading(false);
            return;
        }
        setLoading(true);
        const data: ReportDataEntry[] = [];
        const interval = {
            start: startOfDay(range.from),
            end: startOfDay(range.to || range.from),
        };
        const days = eachDayOfInterval(interval);

        try {
            for (const day of days) {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dailyDocRef = doc(db, 'dailyInventory', dateStr);
                const docSnap = await getDoc(dailyDocRef);
                if (docSnap.exists()) {
                    data.push({ date: dateStr, log: docSnap.data() as DailyLog });
                }
            }
            setReportData(data);
        } catch (error) {
            console.error("Error fetching report data:", error);
            toast({ title: "Error", description: "Failed to fetch report data.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, []);
    
    useEffect(() => {
       fetchReportData(date);
    }, [date, fetchReportData]); 

    const handleFilter = () => {
        fetchReportData(date);
    };
    
    const masterInventoryMap = useMemo(() => {
        const map = new Map<string, InventoryItem>();
        masterInventory.forEach(item => map.set(item.id, item));
        return map;
    }, [masterInventory]);

    const { offCounterSalesData, onBarSalesData } = useMemo(() => {
        const offCounterMap = new Map<string, SoldItem>();
        const onBarMap = new Map<string, OnBarSoldItem>();

        reportData.forEach(entry => {
            for (const productId in entry.log) {
                const item = entry.log[productId] as any;
                
                if (item && item.sales > 0 && !productId.startsWith('on-bar-')) { 
                    const masterItem = masterInventoryMap.get(productId);
                    const itemPrice = Number(item.price || masterItem?.price || 0); // Fallback to master price

                    if (itemPrice > 0) {
                        const existing = offCounterMap.get(productId);
                        if (existing) {
                            existing.unitsSold += item.sales;
                            existing.totalAmount += item.sales * itemPrice;
                        } else {
                            const brand = item.brand || masterItem?.brand || 'Unknown';
                            offCounterMap.set(productId, {
                                productId, 
                                brand,
                                size: item.size || masterItem?.size || '', 
                                category: item.category || masterItem?.category || '',
                                price: itemPrice, 
                                unitsSold: item.sales, 
                                totalAmount: item.sales * itemPrice,
                            });
                        }
                    }
                } else if (item && item.salesValue > 0 && productId.startsWith('on-bar-')) { // OnBar
                     const existing = onBarMap.get(productId);
                     if (existing) {
                         existing.unitsSold += item.salesVolume;
                         existing.totalAmount += item.salesValue;
                     } else {
                        const masterItem = masterInventoryMap.get(productId.replace('on-bar-', ''));
                        const brand = item.brand || masterItem?.brand || 'Unknown';
                         onBarMap.set(productId, {
                             productId, 
                             brand, 
                             size: item.size || masterItem?.size || '', 
                             category: item.category || masterItem?.category || '',
                             unitsSold: item.salesVolume, 
                             totalAmount: item.salesValue
                         });
                     }
                }
            }
        });
        
        const safeSort = (a: { brand?: string }, b: { brand?: string }) => {
            const brandA = a.brand || '';
            const brandB = b.brand || '';
            return brandA.localeCompare(brandB);
        };

        return {
            offCounterSalesData: Array.from(offCounterMap.values()).sort(safeSort),
            onBarSalesData: Array.from(onBarMap.values()).sort(safeSort),
        };
    }, [reportData, masterInventoryMap]);

    const offCounterTotals = useMemo(() => ({
        totalAmount: offCounterSalesData.reduce((sum, item) => sum + item.totalAmount, 0),
        totalUnits: offCounterSalesData.reduce((sum, item) => sum + item.unitsSold, 0)
    }), [offCounterSalesData]);
    
    const onBarTotals = useMemo(() => ({
        totalAmount: onBarSalesData.reduce((sum, item) => sum + item.totalAmount, 0)
    }), [onBarSalesData]);
    
    const grandTotal = offCounterTotals.totalAmount + onBarTotals.totalAmount;

    const handleExportPDF = () => {
        const doc = new jsPDF() as jsPDFWithAutoTable;
        
        const startDate = date?.from ? formatDate(date.from) : '';
        const endDate = date?.to ? formatDate(date.to) : startDate;
        const isSingleDay = !date?.to || isSameDay(date?.from || new Date(), date.to);
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("BHOLE BABA FL ON SHOP", doc.internal.pageSize.width / 2, 15, { align: 'center' });
        
        const dateRangeStr = isSingleDay ? `for ${startDate}` : `from ${startDate} to ${endDate}`;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Sales Statement ${dateRangeStr}`, doc.internal.pageSize.width - 14, 25, { align: 'right' });


        let finalY = 30;

        const addSectionToPdf = (title: string, data: any[], columns: string[], isOffCounter: boolean) => {
            if (data.length === 0) return;

            doc.setFontSize(14);
            doc.text(title, 14, finalY + 10);
            
            const body = data.map(item => isOffCounter ? [
                item.brand, item.size, item.category, item.price.toFixed(2), item.unitsSold, item.totalAmount.toFixed(2)
            ] : [
                item.brand, item.size, item.category, `${item.unitsSold} ${item.category === 'Beer' ? 'units' : 'ml'}`, item.totalAmount.toFixed(2)
            ]);

            const totalAmount = data.reduce((sum, item) => sum + item.totalAmount, 0);
            const foot = isOffCounter ? [
                ['Total', '', '', '', data.reduce((sum, item) => sum + item.unitsSold, 0), totalAmount.toFixed(2)]
            ] : [
                ['Total', '', '', '', totalAmount.toFixed(2)]
            ];

            doc.autoTable({
                head: [columns],
                body,
                foot,
                startY: finalY + 15,
                headStyles: { fillColor: [40, 40, 40] },
                footStyles: { fillColor: [244, 244, 245], textColor: [20, 20, 20], fontStyle: 'bold' },
                didDrawPage: (data) => {
                    finalY = data.cursor?.y || finalY;
                }
            });
            finalY = (doc as any).lastAutoTable.finalY;
        };

        if (reportType === 'offcounter' || reportType === 'both') {
            addSectionToPdf('Off-Counter Sales', offCounterSalesData, ["Brand", "Size", "Category", "Price", "Units Sold", "Total Amount"], true);
        }
        if (reportType === 'onbar' || reportType === 'both') {
            addSectionToPdf('On-Bar Sales', onBarSalesData, ["Brand", "Size", "Category", "Units/Volume Sold", "Total Amount"], false);
        }
        
        if (reportType === 'both' && offCounterSalesData.length > 0 && onBarSalesData.length > 0) {
             doc.autoTable({
                startY: finalY + 10,
                body: [],
                foot: [['Grand Total', '', '', '', grandTotal.toFixed(2)]],
                footStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 12 },
                columnStyles: { 0: { halign: isSameDay(date?.from!, date?.to!) ? 'right' : 'left' } },
                showFoot: 'lastPage'
            });
        }
        
        const fileDate = date?.from ? formatDate(date.from, 'yyyy-MM-dd') : 'report';
        doc.save(`${reportType}_sales_report_${fileDate}.pdf`);

        toast({
            title: "Export Successful",
            description: "Your Sales Statement has been downloaded.",
        });
    };

    const handleExportCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "BHOLE BABA FL ON SHOP\n\n";

        const addSectionToCsv = (title: string, data: any[], headers: string[], isOffCounter: boolean) => {
            if (data.length === 0) return;
            csvContent += `${title}\n`;
            csvContent += headers.join(",") + "\n";
            data.forEach(item => {
                const row = isOffCounter ? [
                    `"${item.brand.replace(/"/g, '""')}"`, `"${item.size}"`, item.category, item.price.toFixed(2), item.unitsSold, item.totalAmount.toFixed(2)
                ] : [
                    `"${item.brand.replace(/"/g, '""')}"`, `"${item.size}"`, item.category, `"${item.unitsSold} ${item.category === 'Beer' ? 'units' : 'ml'}"`, item.totalAmount.toFixed(2)
                ];
                csvContent += row.join(",") + "\n";
            });
            const totalAmount = data.reduce((sum, item) => sum + item.totalAmount, 0);
            const totalRow = isOffCounter ? ["Total", "", "", "", data.reduce((sum, item) => sum + item.unitsSold, 0), totalAmount.toFixed(2)] : ["Total", "", "", "", totalAmount.toFixed(2)];
            csvContent += totalRow.join(",") + "\n\n";
        };

        if (reportType === 'offcounter' || reportType === 'both') {
             addSectionToCsv("Off-Counter Sales", offCounterSalesData, ["Brand", "Size", "Category", "Price", "Units Sold", "Total Amount"], true);
        }
         if (reportType === 'onbar' || reportType === 'both') {
            addSectionToCsv("On-Bar Sales", onBarSalesData, ["Brand", "Size", "Category", "Units/Volume Sold", "Total Amount"], false);
        }

        if (reportType === 'both' && offCounterSalesData.length > 0 && onBarSalesData.length > 0) {
            csvContent += `Grand Total,,,,${grandTotal.toFixed(2)}\n`;
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const fileDate = date?.from ? formatDate(date.from, 'yyyy-MM-dd') : 'report';
        link.setAttribute("download", `${reportType}_sales_report_${fileDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({
            title: "Export Successful",
            description: "Your Sales Statement has been downloaded as a CSV file.",
        });
    };

    if (loading) {
        return null;
    }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Statement</h1>
          <p className="text-muted-foreground font-bold">{formatDate(new Date(), 'dd/MM/yyyy')}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={handleExportPDF} disabled={loading || (offCounterSalesData.length === 0 && onBarSalesData.length === 0)} className="bg-red-600 hover:bg-red-700 text-white">
                <Download className="mr-2 h-4 w-4" />
                Export to PDF
            </Button>
             <Button onClick={handleExportCSV} disabled={loading || (offCounterSalesData.length === 0 && onBarSalesData.length === 0)} className="bg-green-600 hover:bg-green-700 text-white">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export to CSV
            </Button>
        </div>
      </header>
      
        <Card>
            <CardHeader>
                <CardTitle>Report Generation</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                    <Select value={dateRangeOption} onValueChange={handleDateRangeOptionChange}>
                         <SelectTrigger className="w-full md:w-auto">
                            <SelectValue placeholder="Select Date Range" />
                        </SelectTrigger>
                        <SelectContent>
                            {dateRangeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <div className="flex items-center gap-2">
                        <Input
                            type="text"
                            placeholder="From Date"
                            value={dateInputs.from}
                            onChange={(e) => handleDateInputChange(e, 'from')}
                            onBlur={() => handleDateInputBlur('from')}
                            className="w-full md:w-36"
                        />
                         <span className="text-muted-foreground">-</span>
                         <Input
                            type="text"
                            placeholder="To Date"
                            value={dateInputs.to}
                            onChange={(e) => handleDateInputChange(e, 'to')}
                            onBlur={() => handleDateInputBlur('to')}
                            className="w-full md:w-36"
                        />
                    </div>
                </div>
                 <div className="flex-grow md:flex-grow-0 md:ml-auto">
                    <Select value={reportType} onValueChange={(value) => setReportType(value as 'offcounter' | 'onbar' | 'both')}>
                        <SelectTrigger className="w-full md:w-[220px]">
                            <SelectValue placeholder="Select Report Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="both">
                                <div className="flex items-center gap-2">
                                    <Combine className="h-4 w-4" />
                                    <span>Both (Combined)</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="offcounter">
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    <span>Off-Counter Sales</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="onbar">
                                 <div className="flex items-center gap-2">
                                    <GlassWater className="h-4 w-4" />
                                    <span>On-Bar Sales</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
            </CardContent>
        </Card>
        
        {reportType === 'offcounter' || reportType === 'both' ? (
          <Card>
            <CardHeader>
                <CardTitle>Off-Counter Sales Details</CardTitle>
                <CardDescription>An aggregated summary of sales for the selected period.</CardDescription>
            </CardHeader>
            <CardContent>
                    <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Brand</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Units Sold</TableHead>
                                <TableHead className="text-right">Total Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {offCounterSalesData.length > 0 ? (
                                offCounterSalesData.map(item => (
                                    <TableRow key={item.productId}>
                                        <TableCell className="font-medium">{item.brand}</TableCell>
                                        <TableCell>{item.size}</TableCell>
                                        <TableCell>{item.category}</TableCell>
                                        <TableCell className="text-right">{Number(item.price).toFixed(2)}</TableCell>
                                        <TableCell className="text-right">{item.unitsSold}</TableCell>
                                        <TableCell className="text-right font-medium">{item.totalAmount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No Off-Counter sales data for this period.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-muted/50">
                                <TableCell colSpan={4} className="font-bold text-right text-base">Off-Counter Total</TableCell>
                                <TableCell className="font-bold text-right text-base">{offCounterTotals.totalUnits}</TableCell>
                                <TableCell className="font-bold text-right text-base flex items-center justify-end gap-1">
                                    <IndianRupee className="h-4 w-4" />
                                    {offCounterTotals.totalAmount.toFixed(2)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
          </Card>
        ) : null}
        
        {reportType === 'onbar' || reportType === 'both' ? (
             <Card>
                <CardHeader>
                    <CardTitle>On-Bar Sales Details</CardTitle>
                    <CardDescription>An aggregated summary of on-bar sales for the selected period.</CardDescription>
                </CardHeader>
                <CardContent>
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                 <TableRow>
                                    <TableHead>Brand</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Units/Volume Sold</TableHead>
                                    <TableHead className="text-right">Total Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {onBarSalesData.length > 0 ? (
                                    onBarSalesData.map(item => (
                                        <TableRow key={item.productId}>
                                            <TableCell className="font-medium">{item.brand}</TableCell>
                                            <TableCell>{item.size}</TableCell>
                                            <TableCell>{item.category}</TableCell>
                                            <TableCell className="text-right">{`${item.unitsSold} ${item.category === 'Beer' ? 'units' : 'ml'}`}</TableCell>
                                            <TableCell className="text-right font-medium">{item.totalAmount.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No On-Bar sales data for this period.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-muted/50">
                                    <TableCell colSpan={4} className="font-bold text-right text-base">On-Bar Total</TableCell>
                                     <TableCell className="font-bold text-right text-base flex items-center justify-end gap-1">
                                        <IndianRupee className="h-4 w-4" />
                                        {onBarTotals.totalAmount.toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        ) : null}

        {reportType === 'both' && (offCounterSalesData.length > 0 || onBarSalesData.length > 0) && (
             <Card className="border-primary/50">
                <CardHeader>
                    <CardTitle className="text-primary">Grand Total Sales</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end">
                        <p className="text-2xl font-bold flex items-center gap-2">
                           <IndianRupee className="h-6 w-6" /> {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </CardContent>
             </Card>
        )}
    </div>
  );
}
