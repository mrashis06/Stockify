
"use client";

import React, { useMemo, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useDailySaleReport } from '@/hooks/use-daily-sale-report';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IndianRupee, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { usePageLoading } from '@/hooks/use-loading';
import { Button } from '@/components/ui/button';
import { useDateFormat } from '@/hooks/use-date-format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subDays, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

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
    <div className="font-mono font-semibold text-muted-foreground">
      {formatTime(time)}
    </div>
  );
};

export default function DailySalePage() {
    const { toast } = useToast();
    const { formatDate } = useDateFormat();
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dateOption, setDateOption] = useState<'today' | 'yesterday'>('today');

    const { blReport, totalSalesValue, loading, getCategory } = useDailySaleReport(selectedDate);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    
    usePageLoading(loading);

    const handleDateChange = (value: 'today' | 'yesterday') => {
        const newDate = value === 'today' ? new Date() : subDays(new Date(), 1);
        setSelectedDate(newDate);
        setDateOption(value);
    };

    const toggleRowExpansion = (key: string) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setExpandedRows(newSet);
    };
    
    const handleExportPDF = () => {
        const doc = new jsPDF() as jsPDFWithAutoTable;
        const reportDate = formatDate(selectedDate, 'dd/MM/yyyy');
        
        const totalsByCategory = blReport.reduce((acc, sale) => {
            if (!acc[sale.category]) {
                acc[sale.category] = 0;
            }
            acc[sale.category] += sale.bulkLiters;
            return acc;
        }, {} as Record<string, number>);

        const flTotal = totalsByCategory['FL'] || 0;
        const imlTotal = totalsByCategory['IML'] || 0;
        const beerTotal = totalsByCategory['BEER'] || 0;

        // Header
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(`Date: ${reportDate}`, doc.internal.pageSize.width - 14, 15, { align: 'right' });
        
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 116, 91); // Primary color
        doc.text("BHOLE BABA FL ON SHOP", doc.internal.pageSize.width / 2, 30, { align: 'center' });

        // Body
        let yPos = 50;
        doc.setFontSize(14);
        doc.setTextColor(40, 40, 40); // Dark text color
        doc.setFont('helvetica', 'normal');

        const drawLineItem = (label: string, value: string) => {
            doc.text(label, 14, yPos);
            doc.setFont('helvetica', 'bold');
            doc.text(value, doc.internal.pageSize.width - 14, yPos, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            yPos += 12;
        }
        
        if (flTotal > 0) drawLineItem("FL (Foreign Liquor) BL:", `${flTotal.toFixed(3)} Ltrs`);
        if (imlTotal > 0) drawLineItem("IML (Indian Made Liquor) BL:", `${imlTotal.toFixed(3)} Ltrs`);
        if (beerTotal > 0) drawLineItem("BEER BL:", `${beerTotal.toFixed(3)} Ltrs`);
        
        yPos += 5; // Add some space before the total
        doc.setDrawColor(220, 220, 220); // Light gray line
        doc.setLineWidth(0.5);
        doc.line(14, yPos, doc.internal.pageSize.width - 14, yPos); // Line separator
        yPos += 15;
        
        // Footer (Total Sale)
        const totalString = `Rs. ${totalSalesValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        
        doc.setFillColor(22, 163, 74); // Green color for total
        doc.roundedRect(14, yPos - 5, doc.internal.pageSize.width - 28, 16, 3, 3, 'F');

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text("Total Sale", 22, yPos + 4);
        doc.text(totalString, doc.internal.pageSize.width - 22, yPos + 4, { align: 'right' });

        doc.save(`BL_Sale_Report_${format(selectedDate, 'yyyy-MM-dd')}.pdf`);
        
        toast({
            title: "Export Successful",
            description: "Your BL Sale Report has been downloaded.",
        });
    };


    if (loading) {
        return null; // Page loading is handled by the hook
    }

    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">BL Sale Report</h1>
                    <div className="flex items-center gap-2 text-sm">
                        <p className="text-muted-foreground font-bold">{formatDate(selectedDate, 'dd/MM/yyyy')}</p>
                        <span className="text-muted-foreground font-bold">&bull;</span>
                        <RealTimeClock />
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Select onValueChange={handleDateChange} value={dateOption}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Select Date" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="yesterday">Yesterday</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button onClick={handleExportPDF} disabled={blReport.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Export to PDF
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Daily Bulk Liter (BL) Sales Summary</CardTitle>
                    <CardDescription>This report summarizes sales for the selected day, converted into bulk liters for excise purposes.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead className="font-bold text-foreground">Category</TableHead>
                                <TableHead className="font-bold text-foreground">Size (ml)</TableHead>
                                <TableHead className="font-bold text-foreground text-right">Units Sold</TableHead>
                                <TableHead className="font-bold text-foreground text-right">Bulk Liters (BL)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {blReport.length > 0 ? (
                                blReport.map(row => {
                                    const rowKey = `${row.category}-${row.size}`;
                                    const isExpanded = expandedRows.has(rowKey);
                                    return (
                                        <React.Fragment key={rowKey}>
                                            <TableRow>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleRowExpansion(rowKey)}>
                                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="font-medium">{row.category}</TableCell>
                                                <TableCell>{row.size}</TableCell>
                                                <TableCell className="text-right">{row.unitsSold.toFixed(3)}</TableCell>
                                                <TableCell className="text-right font-semibold">{row.bulkLiters.toFixed(3)}</TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="p-0">
                                                        <div className="bg-muted/50 px-6 py-3 text-sm text-muted-foreground">
                                                            <span className="font-semibold text-foreground">Breakdown:</span> {row.breakdown.map(n => n.toFixed(2)).join(' + ')}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No sales recorded for the selected day.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                         <TableFooter>
                            <TableRow className="bg-muted/50 font-bold">
                                <TableCell colSpan={4} className="text-right text-lg">Total Sale Amount</TableCell>
                                <TableCell className="text-right text-lg">
                                    <div className="flex items-center justify-end">
                                        <IndianRupee className="h-5 w-5 mr-1" />
                                        {totalSalesValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </main>
    );
}
