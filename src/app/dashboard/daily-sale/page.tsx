
"use client";

import React, { useMemo } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useInventory } from '@/hooks/use-inventory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IndianRupee, Download } from 'lucide-react';
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
};

const IML_CATEGORIES = ['IML'];
const FL_CATEGORIES = ['Whiskey', 'Rum', 'Vodka', 'Wine', 'Gin', 'Tequila'];
const BEER_CATEGORIES = ['Beer'];

export default function DailySalePage() {
    const { inventory, onBarInventory, loading } = useInventory();
    const { formatDate } = useDateFormat();
    
    usePageLoading(loading);

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
                    const existing = salesMap.get(key) || { unitsSold: 0, size: sizeMl, category };
                    existing.unitsSold += item.sales;
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
                 
                 // Special handling for Beer vs Liquor from On-Bar
                 if (category === 'BEER') {
                    // Beer sales are in units
                    const sizeMatch = item.size.match(/(\d+)/);
                    const sizeMl = sizeMatch ? parseInt(sizeMatch[0], 10) : 0;
                     if (sizeMl > 0) {
                         const key = `${category}-${sizeMl}`;
                         const existing = salesMap.get(key) || { unitsSold: 0, size: sizeMl, category };
                         existing.unitsSold += item.salesVolume; // salesVolume for beer is in units
                         salesMap.set(key, existing);
                     }
                 } else if (category === 'FL' || category === 'IML') {
                    // Liquor sales are in ml, convert to fractional bottles
                    const totalVolumeSold = item.salesVolume; 
                    const bottleSize = item.totalVolume;
                    if (bottleSize > 0) {
                       const unitsSold = totalVolumeSold / bottleSize; // Can be fractional
                       
                       const key = `${category}-${bottleSize}`;
                       const existing = salesMap.get(key) || { unitsSold: 0, size: bottleSize, category };
                       existing.unitsSold += unitsSold;
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
        const doc = new jsPDF() as jsPDFWithAutoTable;
        const today = formatDate(new Date(), 'dd/MM/yyyy');
        
        doc.setFontSize(10);
        doc.text(`Date: ${today}`, 14, 15);
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("BHOLE BABA FL ON SHOP", doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

        doc.autoTable({
            startY: 30,
            head: [['Category', 'Size (ml)', 'Units Sold', 'Bulk Liters (BL)']],
            body: blReport.map(row => [
                row.category,
                row.size,
                row.unitsSold.toFixed(3),
                row.bulkLiters.toFixed(3)
            ]),
            foot: [['Total Today\'s Sale Amount', '', '', `Rs. ${totalSalesValue.toFixed(2)}`]],
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [240, 240, 240] },
        });

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
                                <TableHead className="font-bold text-foreground">Category</TableHead>
                                <TableHead className="font-bold text-foreground">Size (ml)</TableHead>
                                <TableHead className="font-bold text-foreground text-right">Units Sold</TableHead>
                                <TableHead className="font-bold text-foreground text-right">Bulk Liters (BL)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {blReport.length > 0 ? (
                                blReport.map(row => (
                                    <TableRow key={`${row.category}-${row.size}`}>
                                        <TableCell className="font-medium">{row.category}</TableCell>
                                        <TableCell>{row.size}</TableCell>
                                        <TableCell className="text-right">{row.unitsSold.toFixed(3)}</TableCell>
                                        <TableCell className="text-right font-semibold">{row.bulkLiters.toFixed(3)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No sales recorded for today yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                         <TableFooter>
                            <TableRow className="bg-muted/50 font-bold">
                                <TableCell colSpan={3} className="text-right text-lg">Total Today's Sale Amount</TableCell>
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
