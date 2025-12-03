
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, doc, getDoc, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, isToday as isTodayDateFns } from 'date-fns';
import type { InventoryItem } from './use-inventory';

const IML_CATEGORIES = ['iml'];
const FL_CATEGORIES = ['whiskey', 'whisky', 'rum', 'vodka', 'wine', 'gin', 'tequila'];
const BEER_CATEGORIES = ['beer'];

type AggregatedSale = {
    unitsSold: number;
    size: number;
    category: 'FL' | 'IML' | 'BEER';
    breakdown: number[];
};

export function useDailySaleReport(date: Date) {
    const [dailyData, setDailyData] = useState<any>({});
    const [masterInventory, setMasterInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    const dateString = format(date, 'yyyy-MM-dd');

    useEffect(() => {
        setLoading(true);

        const invSub = onSnapshot(collection(db, "inventory"), (snapshot) => {
            const inventory: InventoryItem[] = [];
            snapshot.forEach(doc => {
                inventory.push({ id: doc.id, ...doc.data() } as InventoryItem);
            });
            setMasterInventory(inventory);
        }, (error) => {
             console.error("Error fetching master inventory:", error);
        });


        const dailyDocRef = doc(db, 'dailyInventory', dateString);
        const dailySub = onSnapshot(dailyDocRef, (docSnap) => {
            setDailyData(docSnap.exists() ? docSnap.data() : {});
            setLoading(false);
        }, (error) => {
            console.error("Error fetching daily sale data:", error);
            setLoading(false);
        });

        return () => {
            invSub();
            dailySub();
        };
    }, [dateString]);

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
        let totalValue = 0;
        
        // This check is now robust and determines if we should use live or historical prices.
        const isReportForToday = isTodayDateFns(date);

        for (const productId in dailyData) {
            const itemLog = dailyData[productId];
            
            // Handle Off-Counter Sales
            if (itemLog && itemLog.sales > 0 && !productId.startsWith('on-bar-')) {
                 const masterItem = masterInventory.find(inv => inv.id === productId);
                 if (masterItem) {
                     const sizeMatch = masterItem.size.match(/(\d+)/);
                     const sizeMl = sizeMatch ? parseInt(sizeMatch[0], 10) : 0;
                     const category = getCategory(masterItem.category);
                     
                     if (category && sizeMl > 0) {
                         const key = `${category}-${sizeMl}`;
                         const existing = salesMap.get(key) || { unitsSold: 0, size: sizeMl, category, breakdown: [] };
                         existing.unitsSold += itemLog.sales;
                         existing.breakdown.push(itemLog.sales);
                         salesMap.set(key, existing);
                     }

                     // **THE FIX**: Prioritize the historical price saved in the daily log for past dates.
                     const priceToUse = isReportForToday ? masterItem.price : (itemLog.price || masterItem.price);
                     totalValue += (itemLog.sales * (priceToUse || 0));
                 }
            }
            
            // Handle On-Bar Sales
            else if (itemLog && itemLog.salesValue > 0 && productId.startsWith('on-bar-')) {
                 totalValue += itemLog.salesValue;
                 const category = getCategory(itemLog.category);
                 if (category === 'BEER') {
                     const sizeMatch = itemLog.size.match(/(\d+)/);
                     const sizeMl = sizeMatch ? parseInt(sizeMatch[0], 10) : 0;
                     if (sizeMl > 0) {
                         const key = `${category}-${sizeMl}`;
                         const existing = salesMap.get(key) || { unitsSold: 0, size: sizeMl, category, breakdown: [] };
                         existing.unitsSold += itemLog.salesVolume; // salesVolume is in units for beer
                         existing.breakdown.push(itemLog.salesVolume);
                         salesMap.set(key, existing);
                     }
                 } else if (category === 'FL' || category === 'IML') {
                     const masterItemId = productId.replace('on-bar-', '');
                     const masterItem = masterInventory.find(inv => inv.id === masterItemId);
                     const bottleSize = masterItem ? parseInt(masterItem.size.match(/(\d+)/)?.[0] || '0') : 0;
                     if (bottleSize > 0) {
                         const unitsSold = itemLog.salesVolume / bottleSize;
                         const key = `${category}-${bottleSize}`;
                         const existing = salesMap.get(key) || { unitsSold: 0, size: bottleSize, category, breakdown: [] };
                         existing.unitsSold += unitsSold;
                         existing.breakdown.push(unitsSold);
                         salesMap.set(key, existing);
                     }
                 }
            }
        }

        const report = Array.from(salesMap.values()).map(sale => ({
            ...sale,
            bulkLiters: (sale.unitsSold * sale.size) / 1000,
        })).sort((a,b) => {
            if (a.category < b.category) return -1;
            if (a.category > b.category) return 1;
            return a.size - b.size;
        });

        return { blReport: report, totalSalesValue: totalValue };
    }, [dailyData, masterInventory, date, isTodayDateFns]);


    return { blReport, totalSalesValue, loading, getCategory };
}
