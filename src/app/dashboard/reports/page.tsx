

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
    { label: 'Yesterday', value: 'yesterday' },
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
    
    useEffect(() => {
       handleFilter();
    }, []); 


    const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'from' | 'to') => {
        const separator = dateFormat.includes('-') ? '-' : '/';
        let value = e.target.value;
        const prevValue = dateInputs[field];

        // Handle backspace: allow user to delete separators
        if (value.length < prevValue.length) {
            setDateInputs(prev => ({ ...prev, [field]: value }));
            return;
        }

        const rawValue = value.replace(/[^0-9]/g, '');
        if (rawValue.length > 8) return;

        let formattedValue = rawValue;
        if (rawValue.length > 4) {
            formattedValue = `${rawValue.slice(0, 2)}${separator}${rawValue.slice(2, 4)}${separator}${rawValue.slice(4)}`;
        } else if (rawValue.length > 2) {
            formattedValue = `${rawValue.slice(0, 2)}${separator}${rawValue.slice(2)}`;
        }
        
        setDateInputs(prev => ({ ...prev, [field]: formattedValue }));
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
        } else if (value === 'yesterday') {
            const yesterday = subDays(now, 1);
            setDate({ from: yesterday, to: yesterday });
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

        if (isSingleDay) {
            // Aggregated report for single day
            if (reportType === 'offcounter' || reportType === 'both') {
                if (offCounterSalesData.length > 0) {
                    doc.setFontSize(14);
                    doc.text('Off-Counter Sales', 14, finalY + 10);
                    doc.autoTable({
                        startY: finalY + 15,
                        head: [["Brand", "Size", "Category", "Price", "Units Sold", "Total Amount"]],
                        body: offCounterSalesData.map(item => [item.brand, item.size, item.category, item.price.toFixed(2), item.unitsSold, item.totalAmount.toFixed(2)]),
                        foot: [['Total', '', '', '', offCounterTotals.totalUnits, offCounterTotals.totalAmount.toFixed(2)]],
                        headStyles: { fillColor: [40, 40, 40] },
                        footStyles: { fillColor: [244, 244, 245], textColor: [20, 20, 20], fontStyle: 'bold' },
                    });
                    finalY = (doc as any).lastAutoTable.finalY;
                }
            }
            if (reportType === 'onbar' || reportType === 'both') {
                if (onBarSalesData.length > 0) {
                    doc.setFontSize(14);
                    doc.text('On-Bar Sales', 14, finalY + 10);
                    doc.autoTable({
                        startY: finalY + 15,
                        head: [["Brand", "Size", "Category", "Units/Volume Sold", "Total Amount"]],
                        body: onBarSalesData.map(item => [item.brand, item.size, item.category, `${item.unitsSold} ${item.category === 'Beer' ? 'units' : 'ml'}`, item.totalAmount.toFixed(2)]),
                        foot: [['Total', '', '', '', onBarTotals.totalAmount.toFixed(2)]],
                        headStyles: { fillColor: [40, 40, 40] },
                        footStyles: { fillColor: [244, 244, 245], textColor: [20, 20, 20], fontStyle: 'bold' },
                    });
                    finalY = (doc as any).lastAutoTable.finalY;
                }
            }
        } else {
            // Day-wise report for multi-day range
            let grandTotalOffCounter = { units: 0, amount: 0 };
            let grandTotalOnBar = { amount: 0 };

            reportData.forEach(entry => {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(`Date: ${formatDate(entry.date)}`, 14, finalY + 15);
                finalY += 15;

                const dailyOffCounter: any[] = [];
                const dailyOnBar: any[] = [];
                let dayTotalOffCounter = { units: 0, amount: 0 };
                let dayTotalOnBar = { amount: 0 };

                for (const productId in entry.log) {
                    const item = entry.log[productId] as any;
                    if (item && item.sales > 0 && !productId.startsWith('on-bar-')) {
                        const masterItem = masterInventoryMap.get(productId);
                        const price = Number(item.price || masterItem?.price || 0);
                        if (price > 0) {
                            const totalAmount = item.sales * price;
                            dailyOffCounter.push([item.brand, item.size, item.category, price.toFixed(2), item.sales, totalAmount.toFixed(2)]);
                            dayTotalOffCounter.units += item.sales;
                            dayTotalOffCounter.amount += totalAmount;
                        }
                    } else if (item && item.salesValue > 0 && productId.startsWith('on-bar-')) {
                        dailyOnBar.push([item.brand, item.size, item.category, `${item.salesVolume} ${item.category === 'Beer' ? 'units' : 'ml'}`, item.salesValue.toFixed(2)]);
                        dayTotalOnBar.amount += item.salesValue;
                    }
                }
                
                grandTotalOffCounter.units += dayTotalOffCounter.units;
                grandTotalOffCounter.amount += dayTotalOffCounter.amount;
                grandTotalOnBar.amount += dayTotalOnBar.amount;

                if ((reportType === 'offcounter' || reportType === 'both') && dailyOffCounter.length > 0) {
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Off-Counter Sales', 14, finalY + 8);
                    doc.autoTable({
                        startY: finalY + 10,
                        head: [["Brand", "Size", "Category", "Price", "Units Sold", "Total Amount"]],
                        body: dailyOffCounter,
                        foot: [['Total', '', '', '', dayTotalOffCounter.units, dayTotalOffCounter.amount.toFixed(2)]],
                        headStyles: { fillColor: [40, 40, 40] },
                        footStyles: { fillColor: [244, 244, 245], textColor: [20, 20, 20], fontStyle: 'bold' },
                        showFoot: 'lastPage',
                    });
                    finalY = (doc as any).lastAutoTable.finalY;
                }

                if ((reportType === 'onbar' || reportType === 'both') && dailyOnBar.length > 0) {
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text('On-Bar Sales', 14, finalY + 8);
                    doc.autoTable({
                        startY: finalY + 10,
                        head: [["Brand", "Size", "Category", "Units/Volume Sold", "Total Amount"]],
                        body: dailyOnBar,
                        foot: [['Total', '', '', '', dayTotalOnBar.amount.toFixed(2)]],
                        headStyles: { fillColor: [40, 40, 40] },
                        footStyles: { fillColor: [244, 244, 245], textColor: [20, 20, 20], fontStyle: 'bold' },
                        showFoot: 'lastPage',
                    });
                    finalY = (doc as any).lastAutoTable.finalY;
                }

                if (dailyOffCounter.length === 0 && dailyOnBar.length === 0) {
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.text('No sales recorded for this day.', 14, finalY + 8);
                    finalY += 8;
                }
                 finalY += 5; // Space between days
            });
            
            // Grand Total Summary Page
            doc.addPage();
            doc.setFontSize(18);
            doc.text('Grand Total Summary', doc.internal.pageSize.width / 2, 20, { align: 'center' });
            finalY = 25;

            const summaryBody = [];
            let finalGrandTotal = 0;

            if (reportType === 'offcounter' || reportType === 'both') {
                summaryBody.push(['Off-Counter Sales', grandTotalOffCounter.units.toString(), `Rs. ${grandTotalOffCounter.amount.toFixed(2)}`]);
                finalGrandTotal += grandTotalOffCounter.amount;
            }
             if (reportType === 'onbar' || reportType === 'both') {
                summaryBody.push(['On-Bar Sales', 'N/A', `Rs. ${grandTotalOnBar.amount.toFixed(2)}`]);
                finalGrandTotal += grandTotalOnBar.amount;
            }

            doc.autoTable({
                startY: finalY + 10,
                head: [["Category", "Total Units Sold", "Total Amount"]],
                body: summaryBody,
                foot: [['Grand Total', '', `Rs. ${finalGrandTotal.toFixed(2)}`]],
                headStyles: { fillColor: [40, 40, 40] },
                footStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 12 },
                theme: 'striped',
                didDrawPage: (data) => {
                    // Center the table
                    const tableWidth = data.table.width ?? 0;
                    const pageWidth = doc.internal.pageSize.width;
                    data.cursor.x = (pageWidth - tableWidth) / 2;
                }
            });
        }
        
        if (isSingleDay && grandTotal > 0) {
            let finalYpos = finalY;
            const singleDayGrandTotal = reportType === 'offcounter' ? offCounterTotals.totalAmount : reportType === 'onbar' ? onBarTotals.totalAmount : grandTotal;
            
            if ((doc as any).lastAutoTable) {
              finalYpos = (doc as any).lastAutoTable.finalY;
            }

             doc.autoTable({
                startY: finalYpos + 10,
                body: [],
                foot: [['Grand Total Sales', `Rs. ${singleDayGrandTotal.toFixed(2)}`]],
                footStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 12 },
                columnStyles: { 0: { halign: 'right' } },
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
        
        const finalGrandTotal = reportType === 'offcounter' ? offCounterTotals.totalAmount : reportType === 'onbar' ? onBarTotals.totalAmount : grandTotal;

        if (offCounterSalesData.length > 0 || onBarSalesData.length > 0) {
            csvContent += `Grand Total,,,,${finalGrandTotal.toFixed(2)}\n`;
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
                 <div className="flex-grow md:flex-grow-0 md:ml-auto flex items-center gap-2">
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
                    <Button onClick={handleFilter} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                        Generate
                    </Button>
                 </div>
            </CardContent>
        </Card>
        
        {loading ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : (
        <>
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
                <div className="mt-6 flex justify-end">
                    <div className="min-w-[350px] space-y-2">
                        {(reportType === 'both' || reportType === 'offcounter') && (
                            <div className="flex justify-between items-center py-2">
                                <p className="font-medium text-muted-foreground">Off-Counter Sales Total:</p>
                                <p className="font-semibold flex items-center">
                                    <IndianRupee className="h-4 w-4 mr-1 shrink-0" />
                                    {offCounterTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        )}
                        {(reportType === 'both' || reportType === 'onbar') && (
                             <div className="flex justify-between items-center py-2">
                                <p className="font-medium text-muted-foreground">On-Bar Sales Total:</p>
                                <p className="font-semibold flex items-center">
                                    <IndianRupee className="h-4 w-4 mr-1 shrink-0" />
                                    {onBarTotals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        )}
                        <Separator />
                        <div className="flex justify-between items-center pt-2">
                            <p className="text-xl font-bold text-primary">Grand Total Sales:</p>
                            <p className="text-xl font-bold text-primary flex items-center">
                                <IndianRupee className="h-6 w-6 mr-1 shrink-0" />
                                {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
        )}
    </div>
  );
}



    

