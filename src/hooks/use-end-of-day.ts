

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

export function useEndOfDay() {
  const [isEndingDay, setIsEndingDay] = useState(false);

  const endOfDayProcess = async () => {
    setIsEndingDay(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    
    try {
        const batch = writeBatch(db);

        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailyDocSnap = await getDoc(dailyDocRef);
        const todaysData = dailyDocSnap.exists() ? dailyDocSnap.data() : {};
        
        const masterInventorySnap = await getDocs(collection(db, 'inventory'));

        for (const masterDoc of masterInventorySnap.docs) {
            const masterItem = masterDoc.data();
            const itemId = masterDoc.id;
            
            const dailyItem = todaysData[itemId];
            
            const prevStock = Number(masterItem.prevStock || 0);
            const added = Number(dailyItem?.added || 0);
            const sales = Number(dailyItem?.sales || 0);
            const opening = prevStock + added;
            const closingStock = opening - sales;

            const masterInventoryRef = doc(db, 'inventory', itemId);
            batch.update(masterInventoryRef, { prevStock: closingStock });
        }

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
