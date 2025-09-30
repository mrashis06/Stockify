
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
import type { InventoryItem } from './use-inventory';

export function useEndOfDay() {
  const [isEndingDay, setIsEndingDay] = useState(false);

  // The End of Day process is now simplified.
  // It no longer handles the critical off-counter stock rollover.
  // That logic is now handled automatically when the inventory page loads for a new day.
  // This function's primary role can be to reset daily states, like On-Bar sales, if needed.
  const endOfDayProcess = async () => {
    setIsEndingDay(true);
    try {
      // This function is now safe to click.
      // Currently, it performs no critical inventory actions.
      // We can add logic here later to reset On-Bar inventory if required,
      // but it will NOT touch the master inventory's prevStock.
      
      // Placeholder for any future non-critical EOD tasks.
      await Promise.resolve();

    } catch (error) {
      console.error("Error during end of day process: ", error);
      throw new Error("Failed to process end of day. " + (error as Error).message);
    } finally {
      setIsEndingDay(false);
    }
  };

  return { isEndingDay, endOfDayProcess };
}
