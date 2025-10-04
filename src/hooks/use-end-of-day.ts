
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
   * Processes the end of day by updating the master inventory's `prevStock`
   * with the final closing stock values calculated on the client.
   * This function does not perform calculations; it only writes the provided data.
   * @param finalInventoryState The array of inventory items with the final `closing` stock values.
   */
  const endOfDayProcess = async (finalInventoryState: InventoryItem[]) => {
    setIsEndingDay(true);

    try {
      if (!finalInventoryState || finalInventoryState.length === 0) {
        throw new Error("No inventory data provided to process.");
      }

      const batch = writeBatch(db);

      finalInventoryState.forEach((item) => {
        // We only care about items that are actually in the shop inventory
        if (item.opening && item.opening > 0) {
            const inventoryUpdateRef = doc(db, 'inventory', item.id);
            const finalClosingStock = item.closing ?? 0;
            
            // Update the master inventory item's prevStock for the start of the next day.
            batch.update(inventoryUpdateRef, { prevStock: finalClosingStock < 0 ? 0 : finalClosingStock });
        }
      });

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
