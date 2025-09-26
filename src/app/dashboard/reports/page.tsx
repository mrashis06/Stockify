
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { eachDayOfInterval, isSameDay, parse, startOfDay, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, Download, Filter, Loader2, FileSpreadsheet, IndianRupee, GlassWater, Package } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useSearchParams } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type OffCounterLog = { brand: string; size: string; sales: number; price: number; category: string };
type OnBarLog = { brand: string; size: string; category: string; salesVolume: number; salesValue: number; price: number };

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


export default function ReportsPage() {
    const { formatDate } = useDateFormat();
    const searchParams = useSearchParams();

    const [date, setDate] = useState<DateRange | undefined>(() => {
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        if (fromParam) {
            return {
                from: parseISO(fromParam),
                to: toParam ? parseISO(toParam) : parseISO(fromParam)
            }
        }
        return { from: new Date(), to: new Date() };
    });

    const [reportType, setReportType] = useState<'offcounter' | 'onbar'>('offcounter');
    const [reportData, setReportData] = useState<ReportDataEntry[]>([]);
    const [loading, setLoading] = useState(true);

    usePageLoading(loading);

    const handleDateSelect = (range: DateRange | undefined) => {
        setDate(range);
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
                const dateStr = formatDate(day, 'yyyy-MM-dd');
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
    }, [formatDate]);
    
    useEffect(() => {
       fetchReportData(date);
    }, [date, fetchReportData]); 

    const handleFilter = () => {
        fetchReportData(date);
    };

    const { offCounterSalesData, onBarSalesData } = useMemo(() => {
        const offCounterMap = new Map<string, SoldItem>();
        const onBarMap = new Map<string, OnBarSoldItem>();

        reportData.forEach(entry => {
            for (const productId in entry.log) {
                const item = entry.log[productId] as any;
                if (item.sales && item.sales > 0 && item.price && item.brand && !productId.startsWith('on-bar-')) { // OffCounter
                    const existing = offCounterMap.get(productId);
                    if (existing) {
                        existing.unitsSold += item.sales;
                        existing.totalAmount += item.sales * item.price;
                    } else {
                        offCounterMap.set(productId, {
                            productId, brand: item.brand, size: item.size, category: item.category,
                            price: item.price, unitsSold: item.sales, totalAmount: item.sales * item.price,
                        });
                    }
                } else if (item.salesValue && item.salesValue > 0 && productId.startsWith('on-bar-')) { // OnBar
                     const existing = onBarMap.get(productId);
                     if (existing) {
                         existing.unitsSold += item.salesVolume;
                         existing.totalAmount += item.salesValue;
                     } else {
                         onBarMap.set(productId, {
                             productId, brand: item.brand, size: item.size, category: item.category,
                             unitsSold: item.salesVolume, totalAmount: item.salesValue
                         });
                     }
                }
            }
        });

        return {
            offCounterSalesData: Array.from(offCounterMap.values()).sort((a, b) => a.brand.localeCompare(b.brand)),
            onBarSalesData: Array.from(onBarMap.values()).sort((a, b) => a.brand.localeCompare(b.brand)),
        };
    }, [reportData]);

    const reportTotals = useMemo(() => {
        const data = reportType === 'offcounter' ? offCounterSalesData : onBarSalesData;
        const totalAmount = data.reduce((sum, item) => sum + item.totalAmount, 0);
        const totalUnits = reportType === 'offcounter' 
            ? (data as SoldItem[]).reduce((sum, item) => sum + item.unitsSold, 0)
            : null; // Units are mixed (ml/pcs), so we don't sum them for OnBar

        return { totalAmount, totalUnits };
    }, [reportType, offCounterSalesData, onBarSalesData]);


    const handleExportPDF = () => {
        const doc = new jsPDF() as jsPDFWithAutoTable;
        const isOffCounter = reportType === 'offcounter';
        
        const tableColumn = isOffCounter 
            ? ["Brand", "Size", "Category", "Price", "Units Sold", "Total Amount"]
            : ["Brand", "Size", "Category", "Units/Volume Sold", "Total Amount"];
            
        const dataToExport = isOffCounter ? offCounterSalesData : onBarSalesData;

        const tableRows = dataToExport.map(item => {
            if (isOffCounter) {
                const offItem = item as SoldItem;
                return [offItem.brand, offItem.size, offItem.category, offItem.price.toFixed(2), offItem.unitsSold, offItem.totalAmount.toFixed(2)];
            } else {
                const onBarItem = item as OnBarSoldItem;
                const unitLabel = onBarItem.category === 'Beer' ? 'units' : 'ml';
                return [onBarItem.brand, onBarItem.size, onBarItem.category, `${onBarItem.unitsSold} ${unitLabel}`, onBarItem.totalAmount.toFixed(2)];
            }
        });

        const startDate = date?.from ? formatDate(date.from) : '';
        const endDate = date?.to ? formatDate(date.to) : startDate;
        const isSingleDay = !date?.to || isSameDay(date?.from || new Date(), date.to);
        const dateRangeStr = isSingleDay ? `for ${startDate}` : `from ${startDate} to ${endDate}`;
        const reportTitle = `${isOffCounter ? 'Off-Counter' : 'On-Bar'} Sales Statement ${dateRangeStr}`;

        doc.setFontSize(16);
        doc.text(reportTitle, 14, 15);
        
        const foot = isOffCounter
            ? [['Grand Total', '', '', '', reportTotals.totalUnits, reportTotals.totalAmount.toFixed(2)]]
            : [['Grand Total', '', '', '', reportTotals.totalAmount.toFixed(2)]];

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            foot,
            startY: 25,
            headStyles: { fillColor: [40, 40, 40] },
            footStyles: { fillColor: [22, 163, 74], textColor: [255,255,255], fontStyle: 'bold' },
        });
        
        const fileDate = date?.from ? formatDate(date.from, 'yyyy-MM-dd') : 'report';
        doc.save(`${reportType}_sales_${fileDate}.pdf`);
    };

    const handleExportCSV = () => {
        const isOffCounter = reportType === 'offcounter';
        const headers = isOffCounter 
            ? ["Brand", "Size", "Category", "Price", "Units Sold", "Total Amount"]
            : ["Brand", "Size", "Category", "Units/Volume Sold", "Total Amount"];
        
        let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
        
        const dataToExport = isOffCounter ? offCounterSalesData : onBarSalesData;
        
        dataToExport.forEach(item => {
            let row;
            if (isOffCounter) {
                const offItem = item as SoldItem;
                 row = [
                    `"${offItem.brand.replace(/"/g, '""')}"`, `"${offItem.size}"`, offItem.category, 
                    offItem.price.toFixed(2), offItem.unitsSold, offItem.totalAmount.toFixed(2)
                ].join(",");
            } else {
                 const onBarItem = item as OnBarSoldItem;
                 const unitLabel = onBarItem.category === 'Beer' ? 'units' : 'ml';
                 row = [
                    `"${onBarItem.brand.replace(/"/g, '""')}"`, `"${onBarItem.size}"`, onBarItem.category, 
                    `"${onBarItem.unitsSold} ${unitLabel}"`, onBarItem.totalAmount.toFixed(2)
                 ].join(",");
            }
            csvContent += row + "\n";
        });
        
        const totalRow = isOffCounter
            ? ["Grand Total", "", "", "", reportTotals.totalUnits, reportTotals.totalAmount.toFixed(2)].join(",")
            : ["Grand Total", "", "", "", reportTotals.totalAmount.toFixed(2)].join(",");
        csvContent += "\n" + totalRow + "\n";
        

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const fileDate = date?.from ? formatDate(date.from, 'yyyy-MM-dd') : 'report';
        link.setAttribute("download", `${reportType}_sales_${fileDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

  if (loading) {
    return null;
  }

  const activeData = reportType === 'offcounter' ? offCounterSalesData : onBarSalesData;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Statement</h1>
          <p className="text-muted-foreground">Detailed sales transaction reports</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={handleExportPDF} disabled={loading || activeData.length === 0} className="bg-red-600 hover:bg-red-700 text-white">
                <Download className="mr-2 h-4 w-4" />
                Export to PDF
            </Button>
             <Button onClick={handleExportCSV} disabled={loading || activeData.length === 0} className="bg-green-600 hover:bg-green-700 text-white">
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
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? ( date.to && !isSameDay(date.from, date.to) ? (<>
                                {formatDate(date.from)} - {formatDate(date.to)}</>
                            ) : (formatDate(date.from))) : (<span>Pick a date</span>)}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={handleDateSelect}
                            numberOfMonths={1} disabled={{ after: new Date() }}
                        />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handleFilter} disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                        Generate
                    </Button>
                </div>
                 <div className="flex-grow md:flex-grow-0 md:ml-auto">
                    <Select value={reportType} onValueChange={(value) => setReportType(value as 'offcounter' | 'onbar')}>
                        <SelectTrigger className="w-full md:w-[220px]">
                            <SelectValue placeholder="Select Report Type" />
                        </SelectTrigger>
                        <SelectContent>
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

      <Card>
        <CardHeader>
            <CardTitle>
                {reportType === 'offcounter' ? 'Off-Counter Sales Details' : 'On-Bar Sales Details'}
            </CardTitle>
            <CardDescription>An aggregated summary of sales for the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        {reportType === 'offcounter' ? (
                            <TableRow>
                                <TableHead>Brand</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                                <TableHead className="text-right">Units Sold</TableHead>
                                <TableHead className="text-right">Total Amount</TableHead>
                            </TableRow>
                        ) : (
                             <TableRow>
                                <TableHead>Brand</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Units/Volume Sold</TableHead>
                                <TableHead className="text-right">Total Amount</TableHead>
                            </TableRow>
                        )}
                    </TableHeader>
                    <TableBody>
                        {activeData.length > 0 ? (
                           reportType === 'offcounter' ? (
                                (activeData as SoldItem[]).map(item => (
                                    <TableRow key={item.productId}>
                                        <TableCell className="font-medium">{item.brand}</TableCell>
                                        <TableCell>{item.size}</TableCell>
                                        <TableCell>{item.category}</TableCell>
                                        <TableCell className="text-right">{item.price.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">{item.unitsSold}</TableCell>
                                        <TableCell className="text-right font-medium">{item.totalAmount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))
                           ) : (
                                (activeData as OnBarSoldItem[]).map(item => (
                                    <TableRow key={item.productId}>
                                        <TableCell className="font-medium">{item.brand}</TableCell>
                                        <TableCell>{item.size}</TableCell>
                                        <TableCell>{item.category}</TableCell>
                                        <TableCell className="text-right">{`${item.unitsSold} ${item.category === 'Beer' ? 'units' : 'ml'}`}</TableCell>
                                        <TableCell className="text-right font-medium">{item.totalAmount.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))
                           )
                        ) : (
                            <TableRow>
                                <TableCell colSpan={reportType === 'offcounter' ? 6 : 5} className="h-24 text-center">
                                    No {reportType === 'offcounter' ? 'Off-Counter' : 'On-Bar'} sales data for this period.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-muted/50">
                            <TableCell colSpan={reportType === 'offcounter' ? 4 : 3} className="font-bold text-right text-base">Grand Total</TableCell>
                            {reportType === 'offcounter' && (
                                <TableCell className="font-bold text-right text-base">{reportTotals.totalUnits}</TableCell>
                            )}
                            <TableCell colSpan={reportType === 'offcounter' ? 1 : 2} className="font-bold text-right text-base flex items-center justify-end gap-1">
                                <IndianRupee className="h-4 w-4" />
                                {reportTotals.totalAmount.toFixed(2)}
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
