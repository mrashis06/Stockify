
"use client";

import { useState } from 'react';
import {
  doc,
  writeBatch,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, addDays } from 'date-fns';
import type { InventoryItem } from './use-inventory';
import { useInventory } from './use-inventory';

export function useEndOfDay() {
  const [isEndingDay, setIsEndingDay] = useState(false);
  const resetOffCounterEOD = useInventory.getState().resetOffCounterEOD;

  const endOfDayProcess = async (finalInventoryState: InventoryItem[], forDate: Date) => {
    setIsEndingDay(true);

    try {
      if (!finalInventoryState || finalInventoryState.length === 0) {
        console.log("No inventory data provided to process EOD.");
        return;
      }

      const batch = writeBatch(db);
      const dateStr = format(forDate, 'yyyy-MM-dd');
      const tomorrowStr = format(addDays(forDate, 1), 'yyyy-MM-dd');

      const todayDailyRef = doc(db, 'dailyInventory', dateStr);
      const tomorrowDailyRef = doc(db, 'dailyInventory', tomorrowStr);

      const tomorrowDoc = await getDoc(tomorrowDailyRef);
      const tomorrowData = tomorrowDoc.exists() ? tomorrowDoc.data() : {};

      // Prepare updates for master inventory and tomorrow's daily doc
      finalInventoryState.forEach((item) => {
        const inventoryUpdateRef = doc(db, 'inventory', item.id);
        const finalClosingStock = Math.max(0, item.closing ?? 0);

        // Update master inventory's prevStock only if we are processing today's EOD
        if (format(forDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
            batch.update(inventoryUpdateRef, { prevStock: finalClosingStock });
        }
        
        // Prepare tomorrow's opening stock
        if (!tomorrowData[item.id]) {
            tomorrowData[item.id] = {};
        }
        tomorrowData[item.id].prevStock = finalClosingStock;
      });
      
      // Update today's record with final closing numbers AND THE FINAL PRICE
      const todayUpdatePayload: { [key: string]: any } = { lastEOD: serverTimestamp() };
      finalInventoryState.forEach(item => {
          const finalClosingStock = Math.max(0, item.closing ?? 0);
          
          // Construct the key for the item object
          const itemKey = item.id;
          
          // Get the existing data for this item, or initialize it
          const itemData = (todayUpdatePayload[itemKey] || {});

          // Set the final closing stock and the final price
          itemData.closing = finalClosingStock;
          itemData.price = item.price; // THE CRITICAL FIX: Save the final price.
          
          // Preserve existing values not being overwritten
          itemData.added = item.added;
          itemData.sales = item.sales;
          itemData.prevStock = item.prevStock;
          itemData.brand = item.brand;
          itemData.size = item.size;
          itemData.category = item.category;

          // Place the updated item data back into the payload
          todayUpdatePayload[itemKey] = itemData;
      });
      batch.set(todayDailyRef, todayUpdatePayload, { merge: true });


      // Set tomorrow's opening stock values
      batch.set(tomorrowDailyRef, tomorrowData, { merge: true });

      await batch.commit();
      resetOffCounterEOD(); // Reset EOD state after successful commit

    } catch (error) {
      console.error("Error during Off-Counter end of day process: ", error);
      throw new Error("Failed to process Off-Counter EOD. " + (error as Error).message);
    } finally {
      setIsEndingDay(false);
    }
  };

  return { isEndingDay, endOfDayProcess };
}
