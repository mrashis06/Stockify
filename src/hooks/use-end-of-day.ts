
"use client";

import { useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, addDays } from 'date-fns';

export function useEndOfDay() {
  const [isEndingDay, setIsEndingDay] = useState(false);

  const endOfDayProcess = async () => {
    setIsEndingDay(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    
    try {
      const dailyDocRef = doc(db, 'dailyInventory', today);
      const dailyDocSnap = await getDoc(dailyDocRef);
      
      if (!dailyDocSnap.exists()) {
        throw new Error("Today's inventory data not found. Cannot proceed.");
      }

      const todaysData = dailyDocSnap.data();
      const batch = writeBatch(db);
      
      // Prepare tomorrow's inventory document
      const tomorrowDocRef = doc(db, 'dailyInventory', tomorrow);
      const newDailyData: { [key: string]: any } = {};

      for (const itemId in todaysData) {
        if (Object.prototype.hasOwnProperty.call(todaysData, itemId)) {
          const item = todaysData[itemId];
          
          // Calculate today's closing stock just to be sure
          const opening = (item.prevStock || 0) + (item.added || 0);
          const closing = opening - (item.sales || 0);

          newDailyData[itemId] = {
            brand: item.brand,
            size: item.size,
            category: item.category,
            price: item.price,
            prevStock: closing, // Today's closing is tomorrow's previous
            added: 0,
            sales: 0,
            opening: closing, // Initially opening is the same as prevStock
            closing: closing, // Initially closing is the same as opening
          };
          
          // Also update the master inventory's prevStock for resilience
          const masterInventoryRef = doc(db, 'inventory', itemId);
          batch.update(masterInventoryRef, { prevStock: closing });
        }
      }
      
      // Set the entire document for tomorrow
      batch.set(tomorrowDocRef, newDailyData);

      await batch.commit();

    } catch (error) {
      console.error("Error during end of day process: ", error);
      throw error; // Rethrow to be caught by the component
    } finally {
      setIsEndingDay(false);
    }
  };

  return { isEndingDay, endOfDayProcess };
}

    