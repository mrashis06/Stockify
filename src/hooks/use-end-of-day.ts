
"use client";

import { useState } from 'react';
import {
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { InventoryItem } from './use-inventory';
import { format } from 'date-fns';

export function useEndOfDay() {
  const [isEndingDay, setIsEndingDay] = useState(false);

  /**
   * Processes the end of day for the Off-Counter inventory.
   * 1. Updates the master inventory's `prevStock` with today's closing stock for tomorrow.
   * 2. Saves a clean snapshot of today's sales (including prices) to the daily log for reporting.
   * @param finalInventoryState The array of inventory items with the final `closing` stock values.
   */
  const endOfDayProcess = async (finalInventoryState: InventoryItem[]) => {
    setIsEndingDay(true);

    try {
      if (!finalInventoryState || finalInventoryState.length === 0) {
        console.log("No Off-Counter inventory data provided to process.");
        return;
      }

      const batch = writeBatch(db);
      const today = format(new Date(), 'yyyy-MM-dd');
      const dailyDocRef = doc(db, 'dailyInventory', today);

      const dailyLogUpdate: { [key: string]: any } = {};

      finalInventoryState.forEach((item) => {
        // Only process items that were active in the shop
        if ((item.opening ?? 0) > 0) {
            const inventoryUpdateRef = doc(db, 'inventory', item.id);
            const finalClosingStock = item.closing ?? 0;
            
            // 1. Update master inventory's prevStock for the start of the next day.
            batch.update(inventoryUpdateRef, { prevStock: finalClosingStock < 0 ? 0 : finalClosingStock });

            // 2. Prepare the clean snapshot for the daily sales log if there were sales.
            if ((item.sales ?? 0) > 0) {
                dailyLogUpdate[item.id] = {
                    brand: item.brand,
                    size: item.size,
                    category: item.category,
                    sales: item.sales,
                    price: item.price, // **CRITICAL: Save the price at the time of sale.**
                    added: item.added,
                };
            } else {
                // Ensure items with additions but no sales are still logged if necessary
                // Or handle as needed. For now, we only care about sales for the report.
                // If an item was added but not sold, it's captured in the closing stock.
            }
        }
      });

      // Overwrite today's daily log with the clean, final snapshot.
      // We merge false to replace any previous incremental updates with the final state.
      batch.set(dailyDocRef, dailyLogUpdate, { merge: true });


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

    