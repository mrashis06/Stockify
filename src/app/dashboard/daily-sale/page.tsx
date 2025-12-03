
"use client";

import React, { useMemo, useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useDailySaleReport } from '@/hooks/use-daily-sale-report';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IndianRupee, Download, ChevronDown, ChevronRight, Eye, ChevronUp } from 'lucide-react';
import { usePageLoading } from '@/hooks/use-loading';
import { Button } from '@/components/ui/button';
import { useDateFormat } from '@/hooks/use-date-format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subDays, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useMediaQuery } from 'react-responsive';

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
    <div className="font-mono font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">
      {formatTime(time)}
    </div>
  );
};

const ReportPreviewDialog = ({ isOpen, onOpenChange, report, total, date, formatDate, onDownload }: { isOpen: boolean, onOpenChange: (open: boolean) => void, report: any[], total: number, date: Date, formatDate: (d: Date | string, f?: string) => string, onDownload: () => void }) => {
    const totalsByCategory = report.reduce((acc, sale) => {
        if (!acc[sale.category]) {
            acc[sale.category] = 0;
        }
        acc[sale.category] += sale.bulkLiters;
        return acc;
    }, {} as Record<string, number>);

    const flTotal = totalsByCategory['FL'] || 0;
    const imlTotal = totalsByCategory['IML'] || 0;
    const beerTotal = totalsByCategory['BEER'] || 0;
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-primary text-center text-2xl font-bold">BHOLE BABA FL ON SHOP</DialogTitle>
                    <DialogDescription className="text-center">BL Sale Report for {formatDate(date, 'dd/MM/yyyy')}</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                        {flTotal > 0 && (
                            <div className="flex justify-between items-center">
                                <p className="text-muted-foreground">FL (Foreign Liquor) BL:</p>
                                <p className="font-semibold">{flTotal.toFixed(3)} Ltrs</p>
                            </div>
                        )}
                        {imlTotal > 0 && (
                             <div className="flex justify-between items-center">
                                <p className="text-muted-foreground">IML (Indian Made Liquor) BL:</p>
                                <p className="font-semibold">{imlTotal.toFixed(3)} Ltrs</p>
                            </div>
                        )}
                        {beerTotal > 0 && (
                             <div className="flex justify-between items-center">
                                <p className="text-muted-foreground">BEER BL:</p>
                                <p className="font-semibold">{beerTotal.toFixed(3)} Ltrs</p>
                            </div>
                        )}
                    </div>
                    <Separator />
                     <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg">
                        <p className="text-lg font-bold text-primary">Total Sale</p>
                        <p className="text-lg font-bold text-primary flex items-center">
                            <IndianRupee className="h-5 w-5 mr-1" />
                            {total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
                 <DialogFooter className="grid grid-cols-2 gap-2">
                    <Button onClick={() => onOpenChange(false)} variant="secondary">Close</Button>
                    <Button onClick={onDownload}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function DailySalePage() {
    const { toast } = useToast();
    const { formatDate } = useDateFormat();
    const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dateOption, setDateOption] = useState<'today' | 'yesterday'>('today');

    const { blReport, totalSalesValue, loading } = useDailySaleReport(selectedDate);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    
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
    
    const generatePdf = () => {
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
            <ReportPreviewDialog 
                isOpen={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                report={blReport}
                total={totalSalesValue}
                date={selectedDate}
                formatDate={formatDate}
                onDownload={generatePdf}
            />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">BL Sale Report</h1>
                    <div className="flex items-center gap-2">
                        <p className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">{formatDate(selectedDate, 'dd-MMM-yyyy, EEEE')}</p>
                        <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">&bull;</span>
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
                     <Button onClick={() => setIsPreviewOpen(true)} disabled={blReport.length === 0} variant="outline">
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                    </Button>
                    <Button onClick={generatePdf} disabled={blReport.length === 0}>
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
                    {isMobile ? (
                        <div className="space-y-3">
                            {blReport.length > 0 ? (
                                blReport.map(row => {
                                    const rowKey = `${row.category}-${row.size}`;
                                    const isExpanded = expandedRows.has(rowKey);
                                    return (
                                        <Card key={rowKey} className="overflow-hidden">
                                            <div className="p-4" onClick={() => toggleRowExpansion(rowKey)}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold">{row.category}</h3>
                                                        <p className="text-sm text-muted-foreground">{row.size}ml</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-lg text-primary">{row.bulkLiters.toFixed(3)}</p>
                                                        <p className="text-xs text-muted-foreground">Bulk Liters</p>
                                                    </div>
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div className="bg-muted/50 px-4 py-3 border-t">
                                                    <div className="flex justify-between items-center text-sm mb-2">
                                                        <span className="text-muted-foreground">Units Sold:</span>
                                                        <span className="font-semibold">{row.unitsSold.toFixed(3)}</span>
                                                    </div>
                                                     <div className="flex justify-between items-start text-sm">
                                                        <span className="text-muted-foreground pt-1">Breakdown:</span>
                                                        <p className="font-semibold text-right break-words max-w-[70%]">
                                                            {row.breakdown.map(n => n.toFixed(2)).join(' + ')}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="w-full flex justify-center py-1 bg-muted/30 cursor-pointer" onClick={() => toggleRowExpansion(rowKey)}>
                                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                            </div>
                                        </Card>
                                    )
                                })
                            ) : (
                                <div className="h-24 text-center flex items-center justify-center text-muted-foreground">
                                    No sales recorded for the selected day.
                                </div>
                            )}
                            <Card className="mt-4 bg-muted/50">
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-center">
                                        <p className="text-lg font-bold">Total Sale Amount</p>
                                        <div className="text-lg font-bold flex items-center">
                                            <IndianRupee className="h-5 w-5 mr-1" />
                                            {totalSalesValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
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
                    )}
                </CardContent>
            </Card>
        </main>
    );
}
