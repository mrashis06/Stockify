
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
   * Processes the end of day for the Off-Counter inventory by updating the master inventory's `prevStock`
   * with the final closing stock values calculated on the client.
   * This function only writes the provided data.
   * @param finalInventoryState The array of inventory items with the final `closing` stock values.
   */
  const endOfDayProcess = async (finalInventoryState: InventoryItem[]) => {
    setIsEndingDay(true);

    try {
      if (!finalInventoryState || finalInventoryState.length === 0) {
        // This is not an error if there's simply no off-counter inventory to process.
        // It might be an EOD process from the On-Bar page.
        console.log("No Off-Counter inventory data provided to process.");
        return;
      }

      const batch = writeBatch(db);

      finalInventoryState.forEach((item) => {
        // We only care about items that are actually in the shop inventory
        const openingStock = item.opening ?? 0;
        if (openingStock > 0) {
            const inventoryUpdateRef = doc(db, 'inventory', item.id);
            const finalClosingStock = item.closing ?? 0;
            
            // Update the master inventory item's prevStock for the start of the next day.
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
