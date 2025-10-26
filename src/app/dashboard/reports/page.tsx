
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { eachDayOfInterval, isSameDay, parse, startOfDay, parseISO, isValid, format } from 'date-fns';
import { Calendar as CalendarIcon, Download, Filter, Loader2, FileSpreadsheet, IndianRupee, GlassWater, Package } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
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
import { useInventory, InventoryItem } from '@/hooks/use-inventory';
import { Input } from '@/components/ui/input';


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


export default function ReportsPage() {
    const { formatDate, dateFormat } = useDateFormat();
    const searchParams = useSearchParams();
    const { inventory: masterInventory } = useInventory();

    const [date, setDate] = useState<DateRange | undefined>(() => {
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        if (fromParam) {
            const fromDate = parseISO(fromParam);
            if (isValid(fromDate)) {
                const toDate = toParam ? parseISO(toParam) : fromDate;
                return {
                    from: fromDate,
                    to: isValid(toDate) ? toDate : fromDate
                }
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

    const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'from' | 'to') => {
        const parsedDate = parse(e.target.value, dateFormat, new Date());
        if (isValid(parsedDate)) {
            setDate(prev => ({ ...prev, [field]: parsedDate }));
        } else {
             setDate(prev => ({ ...prev, [field]: undefined }));
        }
    }

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

    const reportTotals = useMemo(() => {
        const data = reportType === 'offcounter' ? offCounterSalesData : onBarSalesData;
        const totalAmount = data.reduce((sum, item) => sum + item.totalAmount, 0);
        const totalUnits = reportType === 'offcounter' 
            ? (data as SoldItem[]).reduce((sum, item) => sum + item.unitsSold, 0)
            : null; // Units are mixed (ml/pcs), so we don't sum them for OnBar

        return { totalAmount, totalUnits };
    }, [reportType, offCounterSalesData, onBarSalesData]);


    const generateRowsForExport = (data: ReportDataEntry[]) => {
        const rows: any[] = [];
        const isOffCounter = reportType === 'offcounter';

        data.forEach(entry => {
            const dailyRows = [];
            for (const productId in entry.log) {
                const item = entry.log[productId] as any;
                const matchesReportType = isOffCounter 
                    ? (item.sales > 0 && !productId.startsWith('on-bar-')) 
                    : (item.salesValue > 0 && productId.startsWith('on-bar-'));
                
                const masterItem = masterInventoryMap.get(productId);
                const itemPrice = item.price || masterItem?.price || 0;

                if (matchesReportType) {
                    if (isOffCounter) {
                         dailyRows.push([
                            entry.date, item.brand, item.size, item.category, 
                            Number(itemPrice).toFixed(2), item.sales, (item.sales * Number(itemPrice)).toFixed(2)
                        ]);
                    } else {
                        const unitLabel = item.category === 'Beer' ? 'units' : 'ml';
                        dailyRows.push([
                           entry.date, item.brand, item.size, item.category, 
                           `${item.salesVolume} ${unitLabel}`, Number(item.salesValue).toFixed(2)
                       ]);
                    }
                }
            }
            rows.push(...dailyRows.sort((a, b) => a[1].localeCompare(b[1]))); // Sort by brand
        });
        return rows;
    };

    const handleExportPDF = () => {
        const doc = new jsPDF() as jsPDFWithAutoTable;
        const isOffCounter = reportType === 'offcounter';
        
        const tableColumn = isOffCounter 
            ? ["Brand", "Size", "Category", "Price", "Units Sold", "Total Amount"]
            : ["Brand", "Size", "Category", "Units/Volume Sold", "Total Amount"];
        
        const startDate = date?.from ? formatDate(date.from) : '';
        const endDate = date?.to ? formatDate(date.to) : startDate;
        const isSingleDay = !date?.to || isSameDay(date?.from || new Date(), date.to);
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("BHOLE BABA FL ON SHOP", doc.internal.pageSize.width / 2, 15, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        const reportTitle = `${isOffCounter ? 'Off-Counter' : 'On-Bar'} Sales Statement`;
        const dateRangeStr = isSingleDay ? `for ${startDate}` : `from ${startDate} to ${endDate}`;

        doc.setFontSize(14);
        doc.text(reportTitle, 14, 25);
        doc.setFontSize(10);
        doc.text(dateRangeStr, 14, 32);

        let startY = 40;
        let grandTotalUnits = 0;
        let grandTotalAmount = 0;
        
        const sortedReportData = [...reportData].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        sortedReportData.forEach((entry, index) => {
            let dailyTotalUnits = 0;
            let dailyTotalAmount = 0;
            const tableRows: (string | number)[][] = [];

            for (const productId in entry.log) {
                const item = entry.log[productId] as any;
                 const matchesReportType = isOffCounter 
                    ? (item.sales > 0 && !productId.startsWith('on-bar-')) 
                    : (item.salesValue > 0 && productId.startsWith('on-bar-'));
                
                const masterItem = masterInventoryMap.get(productId);
                const itemPrice = item.price || masterItem?.price || 0;

                if (matchesReportType) {
                    if (isOffCounter) {
                        if (itemPrice > 0) {
                            tableRows.push([item.brand || '', item.size, item.category, Number(itemPrice).toFixed(2), item.sales, (item.sales * Number(itemPrice)).toFixed(2)]);
                            dailyTotalUnits += item.sales;
                            dailyTotalAmount += item.sales * Number(itemPrice);
                        }
                    } else {
                        const unitLabel = item.category === 'Beer' ? 'units' : 'ml';
                        tableRows.push([item.brand || '', item.size, item.category, `${item.salesVolume} ${unitLabel}`, Number(item.salesValue).toFixed(2)]);
                        dailyTotalAmount += item.salesValue;
                    }
                }
            }

            if (tableRows.length > 0) {
                tableRows.sort((a,b) => (a[0] as string).localeCompare(b[0] as string)); // Sort by brand

                const foot = isOffCounter
                    ? [['Daily Total', '', '', '', dailyTotalUnits, dailyTotalAmount.toFixed(2)]]
                    : [['Daily Total', '', '', '', dailyTotalAmount.toFixed(2)]];

                const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : startY;

                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text(`Sales for ${formatDate(parse(entry.date, 'yyyy-MM-dd', new Date()))}`, 14, finalY + (index === 0 ? 0 : 15));

                doc.autoTable({
                    head: [tableColumn],
                    body: tableRows,
                    foot,
                    startY: finalY + (index === 0 ? 2 : 17),
                    headStyles: { fillColor: [40, 40, 40] },
                    footStyles: { fillColor: [244, 244, 245], textColor: [20, 20, 20], fontStyle: 'bold' },
                    showFoot: 'lastPage',
                });

                grandTotalUnits += dailyTotalUnits;
                grandTotalAmount += dailyTotalAmount;
            }
        });
        
        if (reportData.length > 1 && grandTotalAmount > 0) {
             const finalY = (doc as any).lastAutoTable.finalY;
             doc.autoTable({
                startY: finalY + 10,
                body: [],
                foot: isOffCounter 
                    ? [['Grand Total', '', '', '', grandTotalUnits, grandTotalAmount.toFixed(2)]]
                    : [['Grand Total', '', '', '', grandTotalAmount.toFixed(2)]],
                 footStyles: { fillColor: [22, 163, 74], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 12 },
                 columnStyles: { 0: { halign: 'left' } },
                 showFoot: 'lastPage'
            });
        }
        
        const fileDate = date?.from ? formatDate(date.from, 'yyyy-MM-dd') : 'report';
        doc.save(`${reportType}_sales_report_${fileDate}.pdf`);
    };

    const handleExportCSV = () => {
        const isOffCounter = reportType === 'offcounter';
        const headers = isOffCounter 
            ? ["Date", "Brand", "Size", "Category", "Price", "Units Sold", "Total Amount"]
            : ["Date", "Brand", "Size", "Category", "Units/Volume Sold", "Total Amount"];
        
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "BHOLE BABA FL ON SHOP\n\n"; // Add shop name
        csvContent += headers.join(",") + "\n";
        
        const sortedReportData = [...reportData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let grandTotalUnits = 0;
        let grandTotalAmount = 0;

        sortedReportData.forEach(entry => {
            const dailyRows: any[] = [];
            let dailyTotalUnits = 0;
            let dailyTotalAmount = 0;

            for (const productId in entry.log) {
                const item = entry.log[productId] as any;
                const matchesReportType = isOffCounter 
                    ? (item.sales > 0 && !productId.startsWith('on-bar-')) 
                    : (item.salesValue > 0 && productId.startsWith('on-bar-'));
                
                 const masterItem = masterInventoryMap.get(productId);
                 const itemPrice = item.price || masterItem?.price || 0;

                if (matchesReportType) {
                    let row;
                    if (isOffCounter) {
                        if (itemPrice > 0) {
                            row = [entry.date, `"${(item.brand || '').replace(/"/g, '""')}"`, `"${item.size}"`, item.category, Number(itemPrice).toFixed(2), item.sales, (item.sales * Number(itemPrice)).toFixed(2)];
                            dailyTotalUnits += item.sales;
                            dailyTotalAmount += item.sales * Number(itemPrice);
                        }
                    } else {
                        const unitLabel = item.category === 'Beer' ? 'units' : 'ml';
                        row = [entry.date, `"${(item.brand || '').replace(/"/g, '""')}"`, `"${item.size}"`, item.category, `"${item.salesVolume} ${unitLabel}"`, Number(item.salesValue).toFixed(2)];
                        dailyTotalAmount += item.salesValue;
                    }
                    if (row) dailyRows.push(row);
                }
            }
            
            if(dailyRows.length > 0) {
                 dailyRows.sort((a, b) => a[1].localeCompare(b[1])).forEach(row => {
                    csvContent += row.join(",") + "\n";
                 });
                 const totalRow = isOffCounter
                    ? [`Daily Total for ${entry.date}`, "", "", "", "", dailyTotalUnits, dailyTotalAmount.toFixed(2)].join(",")
                    : [`Daily Total for ${entry.date}`, "", "", "", "", dailyTotalAmount.toFixed(2)].join(",");
                 csvContent += totalRow + "\n\n";

                 grandTotalUnits += dailyTotalUnits;
                 grandTotalAmount += dailyTotalAmount;
            }
        });
        
        if (reportData.length > 1 && grandTotalAmount > 0) {
            const grandTotalRow = isOffCounter
                ? ["Grand Total", "", "", "", "", grandTotalUnits, grandTotalAmount.toFixed(2)].join(",")
                : ["Grand Total", "", "", "", "", grandTotalAmount.toFixed(2)].join(",");
            csvContent += grandTotalRow + "\n";
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const fileDate = date?.from ? formatDate(date.from, 'yyyy-MM-dd') : 'report';
        link.setAttribute("download", `${reportType}_sales_report_${fileDate}.csv`);
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
          <p className="text-muted-foreground font-bold">{formatDate(new Date(), 'dd/MM/yyyy')}</p>
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
                     <div className="flex items-center gap-2">
                        <Input
                            type="text"
                            placeholder="From Date"
                            value={date?.from ? formatDate(date.from) : ''}
                            onChange={(e) => handleDateInputChange(e, 'from')}
                            className="w-full md:w-36"
                        />
                         <span className="text-muted-foreground">-</span>
                         <Input
                            type="text"
                            placeholder="To Date"
                            value={date?.to ? formatDate(date.to) : ''}
                            onChange={(e) => handleDateInputChange(e, 'to')}
                            className="w-full md:w-36"
                        />
                    </div>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            size="icon"
                            className={cn("w-10", !date && "text-muted-foreground")}
                        >
                            <CalendarIcon className="h-4 w-4" />
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
            <CardDescription>An aggregated summary of sales for the selected period. Day-wise breakdown is available in the exports.</CardDescription>
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
                                        <TableCell className="text-right">{Number(item.price).toFixed(2)}</TableCell>
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
