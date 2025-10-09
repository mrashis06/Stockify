

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
   * This function's ONLY responsibility is to update the master inventory's `prevStock` 
   * with the final `closing` stock to prepare for the next day.
   * It is a non-destructive action regarding the current day's logs, allowing
   * sales to be edited even after it has been run.
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
        // We only need to update the master record.
        const inventoryUpdateRef = doc(db, 'inventory', item.id);
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

    