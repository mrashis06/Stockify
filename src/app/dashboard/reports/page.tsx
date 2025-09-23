
"use client";

import React, { useState, useEffect } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { format, addDays } from 'date-fns';
import { Calendar as CalendarIcon, Download, Filter, Loader2 } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { collection, onSnapshot } from 'firebase/firestore';
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
import type { InventoryItem } from '@/hooks/use-inventory';

const chartConfig = {
  sales: {
    label: "Sales (₹)",
    color: "hsl(var(--primary))",
  },
};

// Extend jsPDF with autoTable
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export default function ReportsPage() {
    const [date, setDate] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = onSnapshot(collection(db, "inventory"), (snapshot) => {
            const items: InventoryItem[] = [];
            snapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as InventoryItem);
            });
            setInventory(items);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const salesData = React.useMemo(() => {
        const categorySales = new Map<string, number>();
        inventory.forEach(item => {
            const saleAmount = (item.sales || 0) * item.price;
            if (saleAmount > 0) {
                categorySales.set(item.category, (categorySales.get(item.category) || 0) + saleAmount);
            }
        });

        const sortedSales = Array.from(categorySales.entries())
            .map(([category, sales]) => ({ category, sales }))
            .sort((a, b) => b.sales - a.sales);
        
        return sortedSales.length > 0 ? sortedSales : [{ category: 'No Sales', sales: 0 }];
    }, [inventory]);

    const handleExport = () => {
        const doc = new jsPDF() as jsPDFWithAutoTable;
        const tableColumn = ["Category", "Sales (₹)"];
        const tableRows: (string | number)[][] = [];

        let totalSales = 0;
        salesData.forEach(item => {
            const rowData = [
                item.category,
                item.sales.toLocaleString('en-IN')
            ];
            tableRows.push(rowData);
            totalSales += item.sales;
        });

        doc.autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 20,
            didDrawPage: (data) => {
                // Header
                doc.setFontSize(20);
                doc.setTextColor(40);
                doc.text("Today's Sales Report", data.settings.margin.left, 15);
            },
        });

        // Add total
        const finalY = doc.autoTable.previous.finalY;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(
            `Total Sales: ₹${totalSales.toLocaleString('en-IN')}`,
            doc.internal.pageSize.getWidth() - doc.getTextWidth(`Total Sales: ₹${totalSales.toLocaleString('en-IN')}`) - 14,
            finalY + 10
        );

        doc.save(`sales_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Summary</h1>
          <p className="text-muted-foreground">Today's sales overview</p>
        </div>
        <Button onClick={handleExport} disabled={loading || salesData[0]?.category === 'No Sales'} className="bg-green-600 hover:bg-green-700 text-white">
          <Download className="mr-2 h-4 w-4" />
          Export to PDF
        </Button>
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
                        date.to ? (
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
                        numberOfMonths={2}
                    />
                    </PopoverContent>
                </Popover>
                    <Button className="bg-green-600 hover:bg-green-700 text-white">
                        <Filter className="mr-2 h-4 w-4" />
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

    