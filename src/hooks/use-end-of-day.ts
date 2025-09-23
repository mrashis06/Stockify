
"use client";

import { useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, addDays } from 'date-fns';
import type { OnBarItem } from './use-onbar-inventory';

export function useEndOfDay() {
  const [isEndingDay, setIsEndingDay] = useState(false);

  const endOfDayProcess = async () => {
    setIsEndingDay(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    
    try {
      const dailyDocRef = doc(db, 'dailyInventory', today);
      const dailyDocSnap = await getDoc(dailyDocRef);
      
      const masterInventorySnap = await getDocs(collection(db, 'inventory'));
      const masterInventory = new Map<string, any>();
      masterInventorySnap.forEach(doc => {
          masterInventory.set(doc.id, { id: doc.id, ...doc.data() });
      });

      const todaysData = dailyDocSnap.exists() ? dailyDocSnap.data() : {};
      const batch = writeBatch(db);
      
      const tomorrowDocRef = doc(db, 'dailyInventory', tomorrow);
      const newDailyData: { [key: string]: any } = {};

      // Handle On-Bar Sales
      const onBarSnap = await getDocs(collection(db, 'onBarInventory'));
      const onBarSales = new Map<string, number>();
      let onBarTotalValue = 0;

      onBarSnap.forEach(doc => {
        const item = doc.data() as OnBarItem;
        if (item.salesVolume > 0 && item.inventoryId !== 'manual') {
            const pegValue = (item.price / item.totalVolume) * item.salesVolume;
            onBarTotalValue += pegValue;
            
            // Group on-bar sales by category for reporting
            const masterItem = masterInventory.get(item.inventoryId);
            if(masterItem) {
                const category = masterItem.category || 'Uncategorized';
                onBarSales.set(category, (onBarSales.get(category) || 0) + pegValue);
            }
        }
        // Reset salesVolume for the next day
        batch.update(doc.ref, { salesVolume: 0 });
      });

      // Add On-Bar sales to today's daily doc for historical reporting
      if (onBarSnap.docs.length > 0) {
          const onBarSaleLog = {
              sales: onBarTotalValue,
              price: 1,
              category: "On-Bar Sales", // Special category for reports
          }
          batch.set(dailyDocRef, { 'on-bar-sales': onBarSaleLog }, { merge: true });
      }

      // Iterate over the master inventory to carry over bottle stock
      for (const [itemId, masterItem] of masterInventory.entries()) {
          const todayItem = todaysData[itemId];
          
          const opening = (masterItem.prevStock ?? 0) + (todayItem?.added ?? 0);
          const closingStock = opening - (todayItem?.sales ?? 0);

          newDailyData[itemId] = {
            brand: masterItem.brand,
            size: masterItem.size,
            category: masterItem.category,
            price: masterItem.price,
            prevStock: closingStock,
            added: 0, 
            sales: 0,
            opening: closingStock,
            closing: closingStock,
          };
          
          const masterInventoryRef = doc(db, 'inventory', itemId);
          batch.update(masterInventoryRef, { prevStock: closingStock });
      }
      
      // Set the prepared data for tomorrow
      batch.set(tomorrowDocRef, newDailyData);

      await batch.commit();

    } catch (error) {
      console.error("Error during end of day process: ", error);
      throw error;
    } finally {
      setIsEndingDay(false);
    }
  };

  return { isEndingDay, endOfDayProcess };
}
