
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { eachDayOfInterval, startOfDay, subDays, format, isSameDay, parseISO, isValid, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachWeek, eachMonth, subWeeks, subMonths } from 'date-fns';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Cell } from "recharts"
import { useMediaQuery } from 'react-responsive';

import { usePageLoading } from '@/hooks/use-loading';
import { useDateFormat } from '@/hooks/use-date-format';
import { useInventory } from '@/hooks/use-inventory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IndianRupee, Combine, Package, GlassWater, TrendingUp, BarChart2 } from 'lucide-react';
import { ChartConfig, ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { toast } from '@/hooks/use-toast';

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

type ReportType = 'both' | 'offcounter' | 'onbar';
type TrendType = 'daily' | 'weekly' | 'monthly';
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

    const [trendBy, setTrendBy] = useState<TrendType>('daily');
    const [productFilter, setProductFilter] = useState('all');
    const [reportType, setReportType] = useState<ReportType>('both');
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    usePageLoading(loading || inventoryLoading);

    const masterInventoryMap = useMemo(() => new Map(masterInventory.map(item => [item.id, item])), [masterInventory]);

    const fetchInsightsData = useCallback(async (trend: TrendType, product: string) => {
        setLoading(true);

        const now = new Date();
        let interval;
        let aggregationFormat;

        switch (trend) {
            case 'weekly':
                interval = { start: subWeeks(now, 7), end: now };
                aggregationFormat = 'dd MMM'; // Used for tooltip formatting
                break;
            case 'monthly':
                interval = { start: subMonths(now, 5), end: now };
                aggregationFormat = 'MMM yyyy';
                break;
            case 'daily':
            default:
                interval = { start: subDays(now, 6), end: now };
                aggregationFormat = 'dd MMM';
                break;
        }

        const dataMap = new Map<string, { offcounter: number, onbar: number }>();

        try {
            const allDays = eachDayOfInterval(interval);
            for (const day of allDays) {
                const dateStr = format(day, 'yyyy-MM-dd');
                const isReportForToday = isSameDay(day, new Date());
                const dailyDocRef = doc(db, 'dailyInventory', dateStr);
                const docSnap = await getDoc(dailyDocRef);
                const dailyLog: DailyLog = docSnap.exists() ? docSnap.data() as DailyLog : {};
                
                let dailyOffCounter = 0;
                let dailyOnBar = 0;
                
                for (const productId in dailyLog) {
                    const itemLog = dailyLog[productId];
                    const masterItem = masterInventoryMap.get(productId.replace('on-bar-', ''));
                    
                    if (product !== 'all' && masterItem?.category !== product) {
                        continue;
                    }

                    if (productId.startsWith('on-bar-')) {
                        dailyOnBar += itemLog.salesValue || 0;
                    } else if (itemLog.sales && itemLog.sales > 0) {
                        const price = isReportForToday ? masterItem?.price : (itemLog.price || masterItem?.price);
                        if (price) {
                            dailyOffCounter += itemLog.sales * price;
                        }
                    }
                }
                
                let key: string;
                if (trend === 'weekly') {
                    const weekStart = startOfWeek(day, { weekStartsOn: 1 });
                    const weekEnd = endOfWeek(day, { weekStartsOn: 1 });
                    key = `${format(weekStart, 'dd MMM')} - ${format(weekEnd, 'dd MMM')}`;
                } else if (trend === 'monthly') {
                    key = format(startOfMonth(day), aggregationFormat);
                } else {
                    key = format(day, aggregationFormat);
                }
                
                const existing = dataMap.get(key) || { offcounter: 0, onbar: 0 };
                existing.offcounter += dailyOffCounter;
                existing.onbar += dailyOnBar;
                dataMap.set(key, existing);
            }
            
            const finalData: ChartData[] = Array.from(dataMap.entries()).map(([date, values]) => ({
                date,
                ...values,
                total: values.offcounter + values.onbar,
            }));

            setChartData(finalData);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch insights data.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [masterInventoryMap]);
    
    useEffect(() => {
        if (masterInventory.length > 0) {
             fetchInsightsData(trendBy, productFilter);
        }
    }, [trendBy, productFilter, masterInventory.length, fetchInsightsData]);
    
    const { totalSales, avgDailySales } = useMemo(() => {
        let total = 0;
        chartData.forEach(d => {
            if (reportType === 'both') total += d.total;
            else if (reportType === 'offcounter') total += d.offcounter;
            else if (reportType === 'onbar') total += d.onbar;
        });
        
        let divisor = chartData.length;
        if (trendBy === 'daily' && chartData.length < 7) divisor = 7;
        if (trendBy === 'weekly' && chartData.length < 8) divisor = 8;
        if (trendBy === 'monthly' && chartData.length < 6) divisor = 6;


        return {
            totalSales: total,
            avgDailySales: divisor > 0 ? total / divisor : 0,
        };
    }, [chartData, reportType, trendBy]);
    
     const allCategories = useMemo(() => {
        const cats = new Set(masterInventory.map(i => i.category).filter(Boolean));
        return ['all', ...Array.from(cats).sort()];
    }, [masterInventory]);

    return (
        <div className="space-y-8 max-w-7xl mx-auto w-full">
             <header>
                <h1 className="text-2xl font-bold tracking-tight">Sales Insights</h1>
                <div className="flex items-center gap-2">
                    <p className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">{formatDate(new Date(), 'dd-MMM-yyyy, EEEE')}</p>
                    <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">&bull;</span>
                    <RealTimeClock />
                </div>
            </header>
            
            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
                     <div className="space-y-2">
                        <label className="text-sm font-medium">Products</label>
                        <Select value={productFilter} onValueChange={setProductFilter}>
                            <SelectTrigger><SelectValue placeholder="Filter by product..." /></SelectTrigger>
                            <SelectContent>
                                {allCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat === 'all' ? 'All Products' : cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2">
                        <label className="text-sm font-medium">Trends By</label>
                        <Select value={trendBy} onValueChange={(v) => setTrendBy(v as TrendType)}>
                            <SelectTrigger><SelectValue placeholder="Select trend..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Report Type</label>
                        <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                            <SelectTrigger><SelectValue placeholder="Select report type..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="both"><div className="flex items-center gap-2"><Combine className="h-4 w-4" /> Both</div></SelectItem>
                                <SelectItem value="offcounter"><div className="flex items-center gap-2"><Package className="h-4 w-4" /> Off-Counter</div></SelectItem>
                                <SelectItem value="onbar"><div className="flex items-center gap-2"><GlassWater className="h-4 w-4" /> On-Bar</div></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Sales Amount Analytics</CardTitle>
                    <CardDescription>Visualizing sales amount for the selected period.</CardDescription>
                </CardHeader>
                <CardContent>
                     {loading ? (<div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading chart data...</div>) :
                      chartData.length > 0 ? (
                        <ChartContainer config={chartConfig} className="min-h-[400px] w-full">
                          <BarChart 
                            data={chartData} 
                            margin={{ top: 20, right: isMobile ? 0 : 20, bottom: 20, left: isMobile ? -20 : 20 }}
                            onClick={(state) => {
                                if (isMobile) {
                                    if (state && state.activeTooltipIndex !== undefined) {
                                        setActiveIndex(state.activeTooltipIndex === activeIndex ? null : state.activeTooltipIndex);
                                    } else {
                                        setActiveIndex(null);
                                    }
                                }
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                stroke="#888888" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(value) => {
                                    if (isMobile && trendBy === 'weekly') {
                                        return value.split(' - ')[0]; // Show only start date on mobile for weekly
                                    }
                                    return value;
                                }}
                            />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${Number(value)/1000}k`} />
                            <Tooltip
                                active={isMobile ? activeIndex !== null : undefined}
                                content={<ChartTooltipContent
                                    formatter={(value, name) => (
                                        <div className="flex min-w-[120px] items-center gap-2">
                                            <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{backgroundColor: name === 'Off-Counter' ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-2))'}} />
                                            <div className="flex flex-1 justify-between">
                                                <p className="text-muted-foreground">{name}</p>
                                                <p className="font-bold flex items-center gap-1">
                                                    <IndianRupee className="h-3 w-3" />
                                                    {Number(value).toLocaleString('en-IN')}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                />}
                                cursor={isMobile ? false : true}
                            />
                            <Legend />
                             {(reportType === 'both' || reportType === 'offcounter') && 
                                <Bar dataKey="offcounter" fill="var(--color-offcounter)" radius={isMobile ? 2 : 4} name="Off-Counter">
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} opacity={isMobile ? (activeIndex === index ? 1 : 0.5) : 1} />
                                    ))}
                                </Bar>
                             }
                            {(reportType === 'both' || reportType === 'onbar') && 
                                <Bar dataKey="onbar" fill="var(--color-onbar)" radius={isMobile ? 2 : 4} name="On-Bar">
                                     {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} opacity={isMobile ? (activeIndex === index ? 1 : 0.5) : 1} />
                                    ))}
                                </Bar>
                            }
                          </BarChart>
                        </ChartContainer>
                    ) : (
                        <div className="h-[400px] flex items-center justify-center text-muted-foreground">No sales data for the selected filters.</div>
                    )}
                </CardContent>
            </Card>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Sales</CardTitle><IndianRupee className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold flex items-center"><IndianRupee className="h-6 w-6 mr-1"/>{totalSales.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div><p className="text-xs text-muted-foreground">Total revenue in the selected period.</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Average Sales</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold flex items-center"><IndianRupee className="h-6 w-6 mr-1"/>{avgDailySales.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div><p className="text-xs text-muted-foreground">Average revenue per {trendBy === 'daily' ? 'day' : trendBy.slice(0, -2)}.</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Top Performing Day</CardTitle><BarChart2 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{chartData.length > 0 ? [...chartData].sort((a,b) => b.total - a.total)[0].date : 'N/A'}</div><p className="text-xs text-muted-foreground">Highest sales day in the period.</p></CardContent></Card>
            </div>
        </div>
    );
}

    