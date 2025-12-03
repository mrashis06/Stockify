
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

export function useEndOfDay() {
  const [isEndingDay, setIsEndingDay] = useState(false);

  const endOfDayProcess = async (finalInventoryState: InventoryItem[]) => {
    setIsEndingDay(true);

    try {
      if (!finalInventoryState || finalInventoryState.length === 0) {
        console.log("No inventory data provided to process EOD.");
        return;
      }

      const batch = writeBatch(db);
      const today = format(new Date(), 'yyyy-MM-dd');
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      const todayDailyRef = doc(db, 'dailyInventory', today);
      const tomorrowDailyRef = doc(db, 'dailyInventory', tomorrow);

      const tomorrowDoc = await getDoc(tomorrowDailyRef);
      const tomorrowData = tomorrowDoc.exists() ? tomorrowDoc.data() : {};

      // Prepare updates for master inventory and tomorrow's daily doc
      finalInventoryState.forEach((item) => {
        const inventoryUpdateRef = doc(db, 'inventory', item.id);
        const finalClosingStock = Math.max(0, item.closing ?? 0);

        // Update master inventory's prevStock for the absolute latest state
        batch.update(inventoryUpdateRef, { prevStock: finalClosingStock });
        
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

          // Place the updated item data back into the payload
          todayUpdatePayload[itemKey] = itemData;
      });
      batch.set(todayDailyRef, todayUpdatePayload, { merge: true });


      // Set tomorrow's opening stock values
      batch.set(tomorrowDailyRef, tomorrowData, { merge: true });

      await batch.commit();

    } catch (error) {
      console.error("Error during Off-Counter end of day process: ", error);
      throw new Error("Failed to process Off-Counter EOD. " + (error as Error).message);
    } finally {
      setIsEndingDay(false);
    }
  };

  return { isEndingDay, endOfDayProcess };
}
