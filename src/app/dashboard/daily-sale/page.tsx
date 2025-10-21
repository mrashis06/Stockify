
"use client";

import React, { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useInventory } from '@/hooks/use-inventory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IndianRupee, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { usePageLoading } from '@/hooks/use-loading';
import { Button } from '@/components/ui/button';
import { useDateFormat } from '@/hooks/use-date-format';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type AggregatedSale = {
    unitsSold: number;
    size: number;
    category: 'FL' | 'IML' | 'BEER';
    breakdown: number[];
};

const IML_CATEGORIES = ['iml'];
const FL_CATEGORIES = ['whiskey', 'whisky', 'rum', 'vodka', 'wine', 'gin', 'tequila'];
const BEER_CATEGORIES = ['beer'];


export default function DailySalePage() {
    const { inventory, dailyOnBarSales, totalOnBarSales, loading } = useInventory();
    const { formatDate } = useDateFormat();
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    
    usePageLoading(loading);

    const toggleRowExpansion = (key: string) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setExpandedRows(newSet);
    };
    
    const getCategory = (itemCategory: string): AggregatedSale['category'] | null => {
        if (!itemCategory) return null;
        const lowerCategory = itemCategory.toLowerCase();
        if (FL_CATEGORIES.includes(lowerCategory)) return 'FL';
        if (IML_CATEGORIES.includes(lowerCategory)) return 'IML';
        if (BEER_CATEGORIES.includes(lowerCategory)) return 'BEER';
        return null;
    };


    const { blReport, totalSalesValue } = useMemo(() => {
        const salesMap = new Map<string, AggregatedSale>();

        // 1. Process Off-Counter Sales
        inventory.forEach(item => {
            if (item.sales > 0) {
                const sizeMatch = item.size.match(/(\d+)/);
                const sizeMl = sizeMatch ? parseInt(sizeMatch[0], 10) : 0;
                
                const category = getCategory(item.category);

                if (category && sizeMl > 0) {
                    const key = `${category}-${sizeMl}`;
                    const existing = salesMap.get(key) || { unitsSold: 0, size: sizeMl, category, breakdown: [] };
                    existing.unitsSold += item.sales;
                    existing.breakdown.push(item.sales);
                    salesMap.set(key, existing);
                }
            }
        });
        
        // 2. Process On-Bar Sales from daily log
        dailyOnBarSales.forEach(item => {
            if (item.salesVolume > 0) {
                const category = getCategory(item.category);
                
                if (category === 'BEER') {
                    const sizeMatch = item.size.match(/(\d+)/);
                    const sizeMl = sizeMatch ? parseInt(sizeMatch[0], 10) : 0;
                     if (sizeMl > 0) {
                         const key = `${category}-${sizeMl}`;
                         const existing = salesMap.get(key) || { unitsSold: 0, size: sizeMl, category, breakdown: [] };
                         existing.unitsSold += item.salesVolume; // salesVolume for beer is in units
                         existing.breakdown.push(item.salesVolume);
                         salesMap.set(key, existing);
                     }
                } else if (category === 'FL' || category === 'IML') {
                    // For liquor, daily sales are logged per bottle. We need to find the master inventory item
                    // to figure out how many "units" (bottles) were sold based on ml.
                    const masterItem = inventory.find(inv => inv.id === item.id.replace('on-bar-', ''));
                    const bottleSize = masterItem ? parseInt(masterItem.size.match(/(\d+)/)?.[0] || '0') : 0;

                    if (bottleSize > 0) {
                       const unitsSold = item.salesVolume / bottleSize;
                       const key = `${category}-${bottleSize}`;
                       const existing = salesMap.get(key) || { unitsSold: 0, size: bottleSize, category, breakdown: [] };
                       existing.unitsSold += unitsSold;
                       existing.breakdown.push(unitsSold);
                       salesMap.set(key, existing);
                    }
                }
            }
        });

        // 3. Calculate Bulk Liters and total sales value
        const blReport = Array.from(salesMap.values()).map(sale => ({
            ...sale,
            bulkLiters: (sale.unitsSold * sale.size) / 1000,
        })).sort((a,b) => {
            if (a.category < b.category) return -1;
            if (a.category > b.category) return 1;
            return a.size - b.size;
        });

        const offCounterTotal = inventory.reduce((sum, item) => sum + (item.sales * item.price), 0);
        const totalSalesValue = offCounterTotal + totalOnBarSales;

        return { blReport, totalSalesValue };

    }, [inventory, dailyOnBarSales, totalOnBarSales]);

    const handleExportPDF = () => {
        const doc = new jsPDF() as jsPDFWithAutoTable;
        const today = formatDate(new Date(), 'dd/MM/yyyy');
        
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
        doc.text(`Date: ${today}`, doc.internal.pageSize.width - 14, 15, { align: 'right' });
        
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

        doc.save(`BL_Sale_Report_${formatDate(new Date(), 'yyyy-MM-dd')}.pdf`);
    };


    if (loading) {
        return null; // Page loading is handled by the hook
    }

    return (
        <main className="flex-1 p-4 md:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Today's BL Sale Report</h1>
                     <p className="text-muted-foreground font-bold">{formatDate(new Date(), 'dd/MM/yyyy')}</p>
                </div>
                <Button onClick={handleExportPDF} disabled={blReport.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Export to PDF
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Daily Bulk Liter (BL) Sales Summary</CardTitle>
                    <CardDescription>This report summarizes today's sales converted into bulk liters for excise purposes.</CardDescription>
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
                                        No sales recorded for today yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                         <TableFooter>
                            <TableRow className="bg-muted/50 font-bold">
                                <TableCell colSpan={4} className="text-right text-lg">Total Today's Sale Amount</TableCell>
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

    

    