
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { eachDayOfInterval, startOfDay, subDays, format, isSameDay, parseISO, isValid } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMediaQuery } from 'react-responsive';

import { usePageLoading } from '@/hooks/use-loading';
import { useDateFormat } from '@/hooks/use-date-format';
import { useInventory } from '@/hooks/use-inventory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { IndianRupee, Combine, Package, GlassWater, Calendar as CalendarIcon, TrendingUp, DollarSign, BarChart2 } from 'lucide-react';
import { ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

const RealTimeClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

  return (
    <div className="font-mono font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">
      {formatTime(time)}
    </div>
  );
};

type ReportType = 'both' | 'offcounter' | 'onbar';
type ChartData = {
  date: string;
  offcounter: number;
  onbar: number;
  total: number;
};
type DailyLog = { [itemId: string]: { sales?: number; salesValue?: number; price?: number } };

const chartConfig = {
  offcounter: { label: 'Off-Counter', color: 'hsl(var(--chart-1))' },
  onbar: { label: 'On-Bar', color: 'hsl(var(--chart-2))' },
} satisfies ChartConfig;

export default function InsightsPage() {
    const { inventory: masterInventory, loading: inventoryLoading } = useInventory();
    const { formatDate } = useDateFormat();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
    const [loading, setLoading] = useState(true);

    const [fromDate, setFromDate] = useState<Date | undefined>(subDays(new Date(), 6));
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    const [dateRangeOption, setDateRangeOption] = useState('7d');
    const [reportType, setReportType] = useState<ReportType>('both');
    const [chartData, setChartData] = useState<ChartData[]>([]);

    usePageLoading(loading || inventoryLoading);

    const masterInventoryMap = useMemo(() => new Map(masterInventory.map(item => [item.id, item])), [masterInventory]);

    const fetchInsightsData = useCallback(async (range: { from?: Date, to?: Date }) => {
        if (!range.from) return;
        setLoading(true);

        const interval = { start: startOfDay(range.from), end: startOfDay(range.to || range.from) };
        const days = eachDayOfInterval(interval);
        const data: ChartData[] = [];

        try {
            for (const day of days) {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dailyDocRef = doc(db, 'dailyInventory', dateStr);
                const docSnap = await getDoc(dailyDocRef);
                const dailyLog: DailyLog = docSnap.exists() ? docSnap.data() as DailyLog : {};
                
                let dailyOffCounter = 0;
                let dailyOnBar = 0;
                
                const isToday = isSameDay(day, new Date());

                for (const productId in dailyLog) {
                    const itemLog = dailyLog[productId];
                    if (productId.startsWith('on-bar-')) {
                        dailyOnBar += itemLog.salesValue || 0;
                    } else if (itemLog.sales && itemLog.sales > 0) {
                        const masterItem = masterInventoryMap.get(productId);
                        const price = isToday ? (masterItem?.price || 0) : (itemLog.price || masterItem?.price || 0);
                        dailyOffCounter += itemLog.sales * price;
                    }
                }
                data.push({ date: format(day, 'dd-MMM'), offcounter: dailyOffCounter, onbar: dailyOnBar, total: dailyOffCounter + dailyOnBar });
            }
            setChartData(data);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch insights data.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [masterInventoryMap]);
    
    useEffect(() => {
        if (masterInventory.length > 0) {
             fetchInsightsData({ from: fromDate, to: toDate });
        }
    }, [fromDate, toDate, masterInventory.length, fetchInsightsData]);

    const handleDateRangeChange = (value: string) => {
        setDateRangeOption(value);
        const now = new Date();
        let newFrom = fromDate, newTo = toDate;
        if (value === 'today') { newFrom = now; newTo = now; }
        else if (value === 'yesterday') { newFrom = subDays(now, 1); newTo = subDays(now, 1); }
        else if (value === '7d') { newFrom = subDays(now, 6); newTo = now; }
        else if (value === '30d') { newFrom = subDays(now, 29); newTo = now; }
        setFromDate(newFrom);
        setToDate(newTo);
    };
    
    const { totalSales, avgDailySales, totalUnits } = useMemo(() => {
        let total = 0;
        let units = 0;
        chartData.forEach(d => {
            if (reportType === 'both') total += d.total;
            else if (reportType === 'offcounter') total += d.offcounter;
            else if (reportType === 'onbar') total += d.onbar;
        });
        return {
            totalSales: total,
            avgDailySales: chartData.length > 0 ? total / chartData.length : 0,
            totalUnits: units,
        };
    }, [chartData, reportType]);
    
    const headerDate = useMemo(() => {
        if (!fromDate) return '';
        const start = formatDate(fromDate, 'dd-MMM-yyyy');
        if (!toDate || isSameDay(fromDate, toDate)) return start;
        return `${start} to ${formatDate(toDate, 'dd-MMM-yyyy')}`;
    }, [fromDate, toDate, formatDate]);

    return (
        <div className="space-y-8">
             <header>
                <h1 className="text-2xl font-bold tracking-tight">Sales Insights</h1>
                 <div className="flex items-center gap-2">
                    <p className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">{headerDate}</p>
                    <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">&bull;</span>
                    <RealTimeClock />
                </div>
            </header>
            
            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                        <RadioGroup value={dateRangeOption} onValueChange={handleDateRangeChange} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="today" id="today" /><Label htmlFor="today">Today</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="yesterday" id="yesterday" /><Label htmlFor="yesterday">Yesterday</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="7d" id="7d" /><Label htmlFor="7d">Last 7 days</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="30d" id="30d" /><Label htmlFor="30d">Last 30 days</Label></div>
                        </RadioGroup>
                         <div className="flex items-center gap-2">
                            <Popover><PopoverTrigger asChild><Button variant="outline" className="w-[180px] justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{fromDate ? formatDate(fromDate) : 'From'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar selected={fromDate} onSelect={(d) => {setFromDate(d); setDateRangeOption('custom')}} initialFocus /></PopoverContent></Popover>
                            <span className="text-muted-foreground">-</span>
                            <Popover><PopoverTrigger asChild><Button variant="outline" className="w-[180px] justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{toDate ? formatDate(toDate) : 'To'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar selected={toDate} onSelect={(d) => {setToDate(d); setDateRangeOption('custom')}} initialFocus /></PopoverContent></Popover>
                        </div>
                    </div>
                     <RadioGroup value={reportType} onValueChange={(v) => setReportType(v as ReportType)} className="flex flex-wrap gap-4">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="both" id="both" /><Label htmlFor="both" className="flex items-center gap-2"><Combine/>Combined</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="offcounter" id="offcounter" /><Label htmlFor="offcounter" className="flex items-center gap-2"><Package/>Off-Counter</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="onbar" id="onbar" /><Label htmlFor="onbar" className="flex items-center gap-2"><GlassWater/>On-Bar</Label></div>
                     </RadioGroup>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Sales Amount Analytics</CardTitle>
                    <CardDescription>Visualizing daily sales amount for the selected period.</CardDescription>
                </CardHeader>
                <CardContent>
                     {loading ? (<div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading chart data...</div>) :
                      chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value)/1000}k`} />
                            <Tooltip content={<ChartTooltipContent indicator="dot" />} cursor={false} />
                            <Legend />
                            {reportType !== 'onbar' && <Bar dataKey="offcounter" fill="var(--color-offcounter)" radius={isMobile ? 2 : 4} name="Off-Counter" />}
                            {reportType !== 'offcounter' && <Bar dataKey="onbar" fill="var(--color-onbar)" radius={isMobile ? 2 : 4} name="On-Bar" />}
                          </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[400px] flex items-center justify-center text-muted-foreground">No sales data for the selected period.</div>
                    )}
                </CardContent>
            </Card>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Sales</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold flex items-center"><IndianRupee className="h-6 w-6 mr-1"/>{totalSales.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div><p className="text-xs text-muted-foreground">Total revenue in the selected period.</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Average Daily Sales</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold flex items-center"><IndianRupee className="h-6 w-6 mr-1"/>{avgDailySales.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div><p className="text-xs text-muted-foreground">Average daily revenue.</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Top Performing Day</CardTitle><BarChart2 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{chartData.length > 0 ? [...chartData].sort((a,b) => b.total - a.total)[0].date : 'N/A'}</div><p className="text-xs text-muted-foreground">Highest sales day in the period.</p></CardContent></Card>
            </div>
        </div>
    );
}

