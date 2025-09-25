
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, eachDayOfInterval, isSameDay, parse, isAfter, startOfDay } from 'date-fns';
import { Calendar as CalendarIcon, Download, Filter, Loader2, FileSpreadsheet, IndianRupee, GlassWater } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type DailyLog = { [itemId: string]: { brand: string; size: string; sales: number; price: number; category: string } };

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

type DatedSoldItem = SoldItem & { date: string };


export default function ReportsPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
    const [date, setDate] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });
    const [reportData, setReportData] = useState<ReportDataEntry[]>([]);
    const [loading, setLoading] = useState(true);

    usePageLoading(loading);

    const handleDateSelect = (range: DateRange | undefined) => {
        // This logic allows for intuitive single-day and range selection.
        // If the user selects a start date and then clicks it again, it confirms a single-day selection.
        // If they click a different end date, it creates a range.
        setDate(range);
    };

    const fetchReportData = useCallback(async (range: DateRange) => {
        if (!range.from) {
            toast({ title: "Error", description: "Please select a start date.", variant: "destructive" });
            return;
        }
        setLoading(true);
        const data: ReportDataEntry[] = [];
        // Ensure start of day to avoid timezone issues.
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
        if (date?.from) {
            fetchReportData(date);
        } else {
            // Set a default date range on initial load
            const today = new Date();
            setDate({ from: today, to: today });
            fetchReportData({ from: today, to: today });
        }
    }, []); // Removed `date` from dependencies to let handleFilter trigger fetches

    const handleFilter = () => {
        if (date?.from) {
            fetchReportData(date);
        } else {
            toast({ title: "Error", description: "Please select a date range.", variant: "destructive" });
        }
    };

    const { aggregatedBottleSalesData, totalOnBarSales } = useMemo(() => {
        const salesMap = new Map<string, SoldItem>();
        let onBarTotal = 0;

        reportData.forEach(entry => {
            for (const productId in entry.log) {
                const item = entry.log[productId];
                 if (productId === 'on-bar-sales') {
                    onBarTotal += item.sales || 0;
                    continue;
                }
                if (item.sales && item.sales > 0 && item.price && item.brand) {
                    const existingEntry = salesMap.get(productId);
                    if (existingEntry) {
                        existingEntry.unitsSold += item.sales;
                        existingEntry.totalAmount += item.sales * item.price;
                    } else {
                        salesMap.set(productId, {
                            productId,
                            brand: item.brand,
                            size: item.size,
                            category: item.category,
                            price: item.price,
                            unitsSold: item.sales,
                            totalAmount: item.sales * item.price,
                        });
                    }
                }
            }
        });

        const aggregatedBottleSalesData = Array.from(salesMap.values()).sort((a, b) => a.brand.localeCompare(b.brand));
        return { aggregatedBottleSalesData, totalOnBarSales: onBarTotal };
    }, [reportData]);
    

    const datedSalesDataForExport = useMemo((): DatedSoldItem[] => {
        const sales: DatedSoldItem[] = [];
        reportData.forEach(entry => {
             for (const productId in entry.log) {
                const item = entry.log[productId];
                if (productId === 'on-bar-sales') {
                    sales.push({
                        date: entry.date,
                        productId: 'on-bar-sales',
                        brand: 'On-Bar Sales',
                        size: 'N/A',
                        category: 'On-Bar',
                        price: item.sales, // Total value for the day
                        unitsSold: 1, // Represents one consolidated entry
                        totalAmount: item.sales,
                    });
                    continue;
                }
                if (item.sales && item.sales > 0 && item.price && item.brand) {
                    sales.push({
                        date: entry.date,
                        productId,
                        brand: item.brand,
                        size: item.size,
                        category: item.category,
                        price: item.price,
                        unitsSold: item.sales,
                        totalAmount: item.sales * item.price,
                    });
                }
            }
        });
        return sales.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.brand.localeCompare(b.brand));
    }, [reportData]);

    const reportTotals = useMemo(() => {
        const bottleTotals = aggregatedBottleSalesData.reduce(
            (totals, item) => {
                totals.totalUnits += item.unitsSold;
                totals.grandTotal += item.totalAmount;
                return totals;
            },
            { totalUnits: 0, grandTotal: 0 }
        );
        return {
            bottleTotalUnits: bottleTotals.totalUnits,
            bottleGrandTotal: bottleTotals.grandTotal,
            overallGrandTotal: bottleTotals.grandTotal + totalOnBarSales,
        }
    }, [aggregatedBottleSalesData, totalOnBarSales]);

    const salesByDateForExport = useMemo(() => {
        return datedSalesDataForExport.reduce((acc, item) => {
            (acc[item.date] = acc[item.date] || []).push(item);
            return acc;
        }, {} as Record<string, DatedSoldItem[]>);
    }, [datedSalesDataForExport]);


    const handleExportPDF = () => {
        const doc = new jsPDF() as jsPDFWithAutoTable;
        const tableColumn = ["Brand", "Size", "Category", "Price", "Units Sold", "Total Amount"];
        
        const startDate = date?.from ? format(date.from, 'PPP') : '';
        const endDate = date?.to ? format(date.to, 'PPP') : startDate;
        
        const isSingleDay = !date?.to || isSameDay(date?.from || new Date(), date.to);
        const title = isSingleDay
            ? `Sales Statement for ${startDate}`
            : `Sales Statement: ${startDate} to ${endDate}`;

        let grandTotalAmount = 0;

        let startY = 15;
        
        doc.setFontSize(16);
        doc.text(title, 14, startY);
        startY += 10;
        
        Object.keys(salesByDateForExport).sort().forEach((saleDate, index) => {
            const items = salesByDateForExport[saleDate];
            const tableRows: (string | number)[][] = [];
            let dailyTotalAmount = 0;
            let dailyBottleUnits = 0;

            items.forEach(item => {
                const isOnBar = item.productId === 'on-bar-sales';
                const rowData = [
                    item.brand,
                    item.size,
                    item.category,
                    isOnBar ? 'N/A' : item.price.toFixed(2),
                    isOnBar ? 'N/A' : item.unitsSold,
                    item.totalAmount.toFixed(2)
                ];
                tableRows.push(rowData);
                dailyTotalAmount += item.totalAmount;
                if (!isOnBar) {
                    dailyBottleUnits += item.unitsSold;
                }
            });

            grandTotalAmount += dailyTotalAmount;
            
            const dateObj = parse(saleDate, 'yyyy-MM-dd', new Date());

            const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : startY;

            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                foot: [
                    ['Daily Total', '', '', '', dailyBottleUnits || 'N/A', dailyTotalAmount.toFixed(2)]
                ],
                startY: finalY + (index > 0 ? 15 : 0),
                headStyles: {
                    fillColor: [40, 40, 40], 
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                footStyles: {
                    fillColor: [244, 244, 245],
                    textColor: [20, 20, 20],
                    fontStyle: 'bold',
                },
                didDrawPage: (data) => {
                },
                willDrawPage: (data) => {
                     doc.setFontSize(12);
                     doc.setFont('helvetica', 'bold');
                     doc.text(`Sales for ${format(dateObj, 'PPP')}`, data.settings.margin.left, data.cursor ? data.cursor.y - 5 : startY - 5);
                     if (data.cursor) {
                       data.cursor.y += 2; 
                     }
                }
            });
        });

        if (Object.keys(salesByDateForExport).length > 1 || totalOnBarSales > 0) { 
            const finalY = (doc as any).lastAutoTable.finalY;
            doc.autoTable({
                startY: finalY + 10,
                body: [],
                foot: [
                    ['Grand Total', '', '', '', '', grandTotalAmount.toFixed(2)]
                ],
                 footStyles: {
                    fillColor: [22, 163, 74],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 12,
                },
                columnStyles: { 0: { halign: 'left' } },
            });
        }
        
        const fileDate = date?.from ? format(date.from, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        doc.save(`sales_statement_${fileDate}.pdf`);
    };

    const handleExportCSV = () => {
        const header = ["Date", "Brand", "Size", "Category", "Price", "Units Sold", "Total Amount"];
        let csvContent = "data:text/csv;charset=utf-8," + header.join(",") + "\n";
        
        let grandTotalAmount = 0;

        Object.keys(salesByDateForExport).sort().forEach(saleDate => {
            const items = salesByDateForExport[saleDate];
            let dailyTotalAmount = 0;

            items.forEach(item => {
                const isOnBar = item.productId === 'on-bar-sales';
                const row = [
                    item.date,
                    `"${item.brand.replace(/"/g, '""')}"`,
                    `"${item.size}"`,
                    item.category,
                    isOnBar ? 'N/A' : item.price.toFixed(2),
                    isOnBar ? 'N/A' : item.unitsSold,
                    item.totalAmount.toFixed(2)
                ].join(",");
                csvContent += row + "\n";
                
                dailyTotalAmount += item.totalAmount;
            });

            const dailyTotalRow = [`Daily Total for ${saleDate}`, '', '', '', '', '', dailyTotalAmount.toFixed(2)].join(",");
            csvContent += dailyTotalRow + "\n\n";

            grandTotalAmount += dailyTotalAmount;
        });

        if (Object.keys(salesByDateForExport).length > 1 || totalOnBarSales > 0) {
            const grandTotalRow = ["Grand Total", "", "", "", "", "", grandTotalAmount.toFixed(2)].join(",");
            csvContent += grandTotalRow + "\n";
        }


        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        
        const fileDate = date?.from ? format(date.from, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        link.setAttribute("download", `sales_statement_${fileDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

  if (loading) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Statement</h1>
          <p className="text-muted-foreground">Detailed sales transaction report</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button onClick={handleExportPDF} disabled={loading || datedSalesDataForExport.length === 0} className="bg-red-600 hover:bg-red-700 text-white">
                <Download className="mr-2 h-4 w-4" />
                Export to PDF
            </Button>
             <Button onClick={handleExportCSV} disabled={loading || datedSalesDataForExport.length === 0} className="bg-green-600 hover:bg-green-700 text-white">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export to CSV
            </Button>
        </div>
      </header>
      
      <div className="grid gap-4 md:grid-cols-2">
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Generate Report</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-full sm:w-[300px] justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to && !isSameDay(date.from, date.to) ? (
                                <>
                                {format(date.from, "LLL dd, y")} -{" "}
                                {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={handleDateSelect}
                        numberOfMonths={1}
                        disabled={{ after: new Date() }}
                    />
                    </PopoverContent>
                </Popover>
                <Button onClick={handleFilter} disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                    Generate
                </Button>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On-Bar Sales Total</CardTitle>
                <GlassWater className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                 <div className="text-2xl font-bold flex items-center">
                    <IndianRupee className="h-6 w-6 mr-1" />
                    {totalOnBarSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">
                    Total value from peg sales in the selected period.
                </p>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>
                Sales Details for {date?.from ? (isSameDay(date.from, date.to || date.from) ? format(date.from, 'PPP') : `${format(date.from, 'PPP')} to ${format(date.to || date.from, 'PPP')}`) : 'selected date'}
            </CardTitle>
            <CardDescription>This is an aggregated summary for the selected period. Date-wise details are available in the exports.</CardDescription>
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
                        {aggregatedBottleSalesData.length > 0 ? (
                            aggregatedBottleSalesData.map(item => (
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
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No bottle sales data for the selected period.
                                </TableCell>
                            </TableRow>
                        )}
                        {totalOnBarSales > 0 && (
                             <TableRow className="bg-primary/5">
                                <TableCell className="font-medium">On-Bar Sales</TableCell>
                                <TableCell>N/A</TableCell>
                                <TableCell>On-Bar</TableCell>
                                <TableCell colSpan={2} className="text-right text-muted-foreground">Aggregated Peg Sales</TableCell>
                                <TableCell className="text-right font-medium">
                                    {totalOnBarSales.toFixed(2)}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-muted/50">
                            <TableCell colSpan={4} className="font-bold text-right text-base">Grand Total (All Sales)</TableCell>
                            <TableCell className="font-bold text-right text-base">{reportTotals.bottleTotalUnits}</TableCell>
                            <TableCell className="font-bold text-right text-base flex items-center justify-end gap-1">
                                <IndianRupee className="h-4 w-4" />
                                {reportTotals.overallGrandTotal.toFixed(2)}
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

    

    