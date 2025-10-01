
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

const IML_CATEGORIES = ['IML'];
const FL_CATEGORIES = ['Whiskey', 'Rum', 'Vodka', 'Wine', 'Gin', 'Tequila'];
const BEER_CATEGORIES = ['Beer'];

export default function DailySalePage() {
    const { inventory, onBarInventory, loading } = useInventory();
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

    const { blReport, totalSalesValue } = useMemo(() => {
        const salesMap = new Map<string, AggregatedSale>();

        // 1. Process Off-Counter Sales
        inventory.forEach(item => {
            if (item.sales > 0) {
                const sizeMatch = item.size.match(/(\d+)/);
                const sizeMl = sizeMatch ? parseInt(sizeMatch[0], 10) : 0;
                
                let category: AggregatedSale['category'] | null = null;
                if (FL_CATEGORIES.includes(item.category)) category = 'FL';
                else if (IML_CATEGORIES.includes(item.category)) category = 'IML';
                else if (BEER_CATEGORIES.includes(item.category)) category = 'BEER';

                if (category && sizeMl > 0) {
                    const key = `${category}-${sizeMl}`;
                    const existing = salesMap.get(key) || { unitsSold: 0, size: sizeMl, category, breakdown: [] };
                    existing.unitsSold += item.sales;
                    existing.breakdown.push(item.sales);
                    salesMap.set(key, existing);
                }
            }
        });
        
        // 2. Process On-Bar Sales
        onBarInventory.forEach(item => {
            if (item.salesVolume > 0) {
                 let category: AggregatedSale['category'] | null = null;
                 if (FL_CATEGORIES.includes(item.category)) category = 'FL';
                 else if (IML_CATEGORIES.includes(item.category)) category = 'IML';
                 else if (BEER_CATEGORIES.includes(item.category)) category = 'BEER';
                 
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
                    const totalVolumeSold = item.salesVolume; 
                    const bottleSize = item.totalVolume;
                    if (bottleSize > 0) {
                       const unitsSold = totalVolumeSold / bottleSize;
                       
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
        const onBarTotal = onBarInventory.reduce((sum, item) => sum + item.salesValue, 0);
        const totalSalesValue = offCounterTotal + onBarTotal;

        return { blReport, totalSalesValue };

    }, [inventory, onBarInventory]);

    const handleExportPDF = () => {
        const doc = new jsPDF();
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

        doc.setFontSize(10);
        doc.text(`Date: ${today}`, 105, 15, { align: 'center' });
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("BHOLE BABA FL ON SHOP", 105, 25, { align: 'center' });

        let yPos = 40;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');

        if (flTotal > 0) {
            doc.text(`FL: ${flTotal.toFixed(3)}`, 14, yPos);
            yPos += 10;
        }
        if (imlTotal > 0) {
            doc.text(`IML: ${imlTotal.toFixed(3)}`, 14, yPos);
            yPos += 10;
        }
        if (beerTotal > 0) {
            doc.text(`BEER: ${beerTotal.toFixed(3)}`, 14, yPos);
            yPos += 10;
        }
        
        yPos += 5; // Add some space before the total
        doc.setLineWidth(0.5);
        doc.line(14, yPos, 196, yPos); // Line separator
        yPos += 10;

        doc.setFont('helvetica', 'bold');
        doc.text(`Total Sale: Rs. ${totalSalesValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, yPos);
        

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
                     <p className="text-muted-foreground">Generated on: {formatDate(new Date(), 'dd/MM/yyyy')}</p>
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

    