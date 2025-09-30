
"use client";

import { useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  writeBatch,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, addDays } from 'date-fns';
import type { OnBarItem } from './use-onbar-inventory';

export function useEndOfDay() {
  const [isEndingDay, setIsEndingDay] = useState(false);

  const endOfDayProcess = async () => {
    setIsEndingDay(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    
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
      

      // Handle On-Bar Sales
      const onBarSnap = await getDocs(collection(db, 'onBarInventory'));
      const onBarSalesLog: { [key: string]: any } = {};

      onBarSnap.forEach(doc => {
        const item = doc.data() as OnBarItem;
        if (item.salesValue && item.salesValue > 0) {
            const onBarLogId = `on-bar-${item.id}`;
            onBarSalesLog[onBarLogId] = {
                brand: item.brand,
                size: item.size,
                category: item.category,
                // price is not logged here as it's variable (pegs)
                salesVolume: item.salesVolume,
                salesValue: item.salesValue,
            };
        }
        // Reset sales volumes and values for the next day
        batch.update(doc.ref, { salesVolume: 0, salesValue: 0 });
      });

      // Add On-Bar sales to today's daily doc for historical reporting
      if (Object.keys(onBarSalesLog).length > 0) {
          batch.set(dailyDocRef, onBarSalesLog, { merge: true });
      }

      // Iterate over the master inventory to update the final closing stock as the new prevStock for tomorrow
      for (const [itemId, masterItem] of masterInventory.entries()) {
          const todayItem = todaysData[itemId];
          
          // CRITICAL FIX: Ensure all values are treated as numbers before calculations
          const prevStock = Number(masterItem.prevStock ?? 0);
          const added = Number(todayItem?.added ?? 0);
          const sales = Number(todayItem?.sales ?? 0);
          const opening = prevStock + added;
          const closingStock = opening - sales;

          // Update the master inventory's prevStock to be today's closing stock.
          // This value will be picked up tomorrow as the opening stock.
          const masterInventoryRef = doc(db, 'inventory', itemId);
          batch.update(masterInventoryRef, { prevStock: closingStock });
      }
      
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

    