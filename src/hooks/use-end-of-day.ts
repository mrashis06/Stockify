

"use client";

import { useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  writeBatch,
  getDocs,
  setDoc,
  updateDoc,
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
        const batch = writeBatch(db);

        // 1. Get today's daily inventory log
        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailyDocSnap = await getDoc(dailyDocRef);
        const todaysData = dailyDocSnap.exists() ? dailyDocSnap.data() : {};
        
        // 2. Get the master inventory list
        const masterInventorySnap = await getDocs(collection(db, 'inventory'));

        // 3. Iterate through master list and update prevStock for next day based on today's closing stock
        for (const masterDoc of masterInventorySnap.docs) {
            const masterItem = masterDoc.data();
            const itemId = masterDoc.id;
            
            const dailyItem = todaysData[itemId];
            
            // Ensure all calculations are done with numbers
            const prevStock = Number(masterItem.prevStock || 0);
            const added = Number(dailyItem?.added || 0);
            const sales = Number(dailyItem?.sales || 0);
            const opening = prevStock + added;
            const closingStock = opening - sales;

            // Update the master inventory's prevStock. This will be the opening stock for the next day.
            const masterInventoryRef = doc(db, 'inventory', itemId);
            batch.update(masterInventoryRef, { prevStock: closingStock });
        }

        // 4. Handle On-Bar Sales: Log them to today's record and reset for tomorrow.
        const onBarSnap = await getDocs(collection(db, 'onBarInventory'));
        const onBarSalesLog: { [key: string]: any } = {};

        onBarSnap.forEach(doc => {
            const item = doc.data() as OnBarItem;
            // Log sales if they occurred
            if (item.salesValue && item.salesValue > 0) {
                const onBarLogId = `on-bar-${item.id}`;
                onBarSalesLog[onBarLogId] = {
                    brand: item.brand,
                    size: item.size,
                    category: item.category,
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

        // Commit all changes atomically
        await batch.commit();

    } catch (error) {
      console.error("Error during end of day process: ", error);
      throw new Error("Failed to process end of day. " + (error as Error).message);
    } finally {
      setIsEndingDay(false);
    }
  };

  return { isEndingDay, endOfDayProcess };
}
