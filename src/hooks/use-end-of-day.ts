
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

  const endOfDayProcess = async () => {
    setIsEndingDay(true);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

    try {
      const batch = writeBatch(db);
      const inventorySnapshot = await getDocs(collection(db, 'inventory'));
      const dailyDocRef = doc(db, 'dailyInventory', todayStr);
      const dailyDoc = await getDoc(dailyDocRef);
      const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};

      inventorySnapshot.forEach((doc) => {
        const item = { id: doc.id, ...doc.data() } as InventoryItem;
        const dailyItem = dailyData[item.id] || {};
        
        const opening = Number(item.prevStock || 0) + Number(dailyItem.added || 0);
        const closing = opening - Number(dailyItem.sales || 0);

        const inventoryUpdateRef = doc.ref;
        batch.update(inventoryUpdateRef, { prevStock: closing });
      });

      // Also reset on-bar sales data for the next day
      const onBarSnapshot = await getDocs(collection(db, 'onBarInventory'));
      onBarSnapshot.forEach((doc) => {
        batch.update(doc.ref, { salesVolume: 0, salesValue: 0 });
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

    