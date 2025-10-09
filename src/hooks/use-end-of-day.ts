
"use client";

import { useState } from 'react';
import {
  doc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { InventoryItem } from './use-inventory';

export function useEndOfDay() {
  const [isEndingDay, setIsEndingDay] = useState(false);

  /**
   * Processes the end of day for the Off-Counter inventory.
   * Its ONLY responsibility is to update the master inventory's `prevStock` 
   * with today's final `closing` stock to prepare for the next day.
   * It no longer writes a summary to the daily log, allowing edits to persist.
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

      finalInventoryState.forEach((item) => {
        // Only process items that were active in the shop
        if ((item.opening ?? 0) > 0 || (item.sales ?? 0) > 0 || (item.added ?? 0) > 0) {
            const inventoryUpdateRef = doc(db, 'inventory', item.id);
            const finalClosingStock = item.closing ?? 0;
            
            // Update master inventory's prevStock for the start of the next day.
            batch.update(inventoryUpdateRef, { prevStock: finalClosingStock < 0 ? 0 : finalClosingStock });
        }
      });

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
