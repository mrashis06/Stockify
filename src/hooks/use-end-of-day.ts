

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
   * Processes the end-of-day by updating the master inventory's `prevStock` 
   * for each item with its final closing stock for the day. This function
   * is designed to be a simple "writer" and relies on the calling component
   * to provide the correct final inventory state.
   * @param finalInventoryState The complete, final state of the inventory for the day.
   */
  const endOfDayProcess = async (finalInventoryState: InventoryItem[]) => {
    setIsEndingDay(true);

    try {
      if (!finalInventoryState || finalInventoryState.length === 0) {
        console.log("No inventory data provided to process EOD.");
        return;
      }

      const batch = writeBatch(db);

      finalInventoryState.forEach((item) => {
        const inventoryUpdateRef = doc(db, 'inventory', item.id);
        
        // The final closing stock is calculated on the page and passed in.
        // This value will be used as the opening stock for the next day.
        const finalClosingStock = item.closing ?? 0;
        
        // Update master inventory's prevStock for the start of the next day.
        batch.update(inventoryUpdateRef, { prevStock: finalClosingStock < 0 ? 0 : finalClosingStock });
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
