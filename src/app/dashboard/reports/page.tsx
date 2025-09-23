"use client";

import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { format, addDays } from 'date-fns';
import { Calendar as CalendarIcon, Download, Filter } from 'lucide-react';
import { DateRange } from "react-day-picker";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart";


const salesData = [
  { category: 'Whiskey', sales: 0 },
  { category: 'Rum', sales: 0 },
  { category: 'Vodka', sales: 0 },
  { category: 'Gin', sales: 0 },
  { category: 'Tequila', sales: 0 },
  { category: 'Beer', sales: 0 },
];

const chartConfig = {
  sales: {
    label: "Sales (₹)",
    color: "hsl(var(--primary))",
  },
};

export default function ReportsPage() {
    const [date, setDate] = React.useState<DateRange | undefined>({
        from: new Date(),
        to: addDays(new Date(), 7),
    });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Summary</h1>
          <p className="text-muted-foreground">Daily and monthly sales overview</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700 text-white">
          <Download className="mr-2 h-4 w-4" />
          Export to PDF/Excel
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
        </CardContent>
      </Card>
    </div>
  );
}
