
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { format, eachDayOfInterval, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, Download, Filter, Loader2, FileSpreadsheet } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { toast } from '@/hooks/use-toast';

const chartConfig = {
  sales: {
    label: "Sales (INR)",
    color: "hsl(var(--primary))",
  },
};

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type DailyLog = { [itemId: string]: { sales: number; price: number; category: string } };

export default function ReportsPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
    const [date, setDate] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });
    const [reportData, setReportData] = useState<DailyLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchReportData = useCallback(async (range: DateRange) => {
        if (!range.from) {
            toast({ title: "Error", description: "Please select a start date.", variant: "destructive" });
            return;
        }
        setLoading(true);
        const data: DailyLog[] = [];
        const interval = {
            start: range.from,
            end: range.to || range.from,
        };
        const days = eachDayOfInterval(interval);

        try {
            for (const day of days) {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dailyDocRef = doc(db, 'dailyInventory', dateStr);
                const docSnap = await getDoc(dailyDocRef);
                if (docSnap.exists()) {
                    data.push(docSnap.data() as DailyLog);
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
    
    // Fetch today's data on initial load
    useEffect(() => {
        fetchReportData({ from: new Date(), to: new Date() });
    }, [fetchReportData]);

    const handleFilter = () => {
        if (date) {
            fetchReportData(date);
        } else {
            toast({ title: "Error", description: "Please select a date range.", variant: "destructive" });
        }
    };


    const salesData = useMemo(() => {
        const categorySales = new Map<string, number>();
        reportData.forEach(dailyLog => {
            for (const itemId in dailyLog) {
                const item = dailyLog[itemId];
                if (item.sales && item.price && item.category) {
                    const saleAmount = item.sales * item.price;
                    categorySales.set(item.category, (categorySales.get(item.category) || 0) + saleAmount);
                }
            }
        });

        const sortedSales = Array.from(categorySales.entries())
            .map(([category, sales]) => ({ category, sales }))
            .sort((a, b) => b.sales - a.sales);
        
        return sortedSales.length > 0 ? sortedSales : [{ category: 'No Sales', sales: 0 }];
    }, [reportData]);

    const handleExportPDF = () => {
        const doc = new jsPDF() as jsPDFWithAutoTable;
        const tableColumn = ["Category", "Sales (INR)"];
        const tableRows: (string | number)[][] = [];

        let totalSales = 0;
        salesData.forEach(item => {
            if (item.category === 'No Sales') return;
            const rowData = [
                item.category,
                item.sales.toLocaleString('en-IN')
            ];
            tableRows.push(rowData);
            totalSales += item.sales;
        });

        const startDate = date?.from ? format(date.from, 'PPP') : '';
        const endDate = date?.to ? format(date.to, 'PPP') : startDate;
        
        const isSingleDay = !date?.to || isSameDay(date?.from || new Date(), date.to);
        const title = isSingleDay
            ? `Sales Report for ${startDate}`
            : `Sales Report: ${startDate} to ${endDate}`;

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            foot: [['Total Sales', totalSales.toLocaleString('en-IN')]],
            startY: 20,
            headStyles: {
                fillColor: [22, 163, 74], // Green background for header
                textColor: [255, 255, 255],
                fontStyle: 'bold'
            },
            footStyles: {
                fillColor: [244, 244, 245],
                textColor: [20, 20, 20],
                fontStyle: 'bold',
            },
            didDrawPage: (data) => {
                doc.setFontSize(16);
                doc.setTextColor(40);
                doc.text(title, data.settings.margin.left, 15);
            },
        });
        
        const fileDate = date?.from ? format(date.from, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        doc.save(`sales_report_${fileDate}.pdf`);
    };

    const handleExportCSV = () => {
        const header = ["Category", "Sales (INR)"];
        let csvContent = "data:text/csv;charset=utf-8," + header.join(",") + "\n";
        
        let totalSales = 0;
        salesData.forEach(item => {
            if (item.category === 'No Sales') return;
            const row = [item.category, item.sales].join(",");
            csvContent += row + "\n";
            totalSales += item.sales;
        });

        csvContent += "\n";
        csvContent += `Total Sales,${totalSales}\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        
        const fileDate = date?.from ? format(date.from, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
        link.setAttribute("download", `sales_report_${fileDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Summary</h1>
          <p className="text-muted-foreground">Historical sales overview</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={handleExportPDF} disabled={loading || salesData[0]?.category === 'No Sales'} className="bg-green-600 hover:bg-green-700 text-white">
                <Download className="mr-2 h-4 w-4" />
                Export to PDF
            </Button>
             <Button onClick={handleExportCSV} disabled={loading || salesData[0]?.category === 'No Sales'} className="bg-blue-600 hover:bg-blue-700 text-white">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export to CSV
            </Button>
        </div>
      </header>
      
      <Card>
        <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <CardTitle>Reports</CardTitle>
                <div className="flex items-center gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-[240px] justify-start text-left font-normal",
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
                        onSelect={setDate}
                        numberOfMonths={1}
                    />
                    </PopoverContent>
                </Popover>
                    <Button onClick={handleFilter} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                        Filter
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent>
             {loading ? (
                <div className="flex justify-center items-center h-[400px]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-4 text-muted-foreground">Loading Report Data...</span>
                </div>
            ) : (
            <Card>
                <CardHeader>
                    <CardTitle>Sales by Category</CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                    <ChartContainer config={chartConfig}>
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={salesData}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                            <YAxis
                                dataKey="category"
                                type="category"
                                tickLine={false}
                                axisLine={false}
                                stroke="hsl(var(--muted-foreground))"
                                width={80}
                                tick={{fontSize: 12}}
                            />
                            <XAxis type="number" stroke="hsl(var(--muted-foreground))" tickFormatter={(value) => `₹${Number(value) / 1000}k`} />
                            <Tooltip
                                cursor={{ fill: 'hsla(var(--muted-foreground), 0.2)' }}
                                content={<ChartTooltipContent indicator="dot" formatter={(value) => `₹${value.toLocaleString()}`} />}
                            />
                            <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                                <LabelList dataKey="sales" position="right" offset={10} className="fill-foreground" formatter={(value: number) => `₹${value.toLocaleString()}`} />
                            </Bar>
                        </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
