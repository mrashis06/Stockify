
"use client";

import { useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  writeBatch,
  setDoc,
  getDocs,
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
      
      const masterInventorySnap = await getDocs(collection(db, 'inventory'));
      const masterInventory = new Map<string, any>();
      masterInventorySnap.forEach(doc => {
          masterInventory.set(doc.id, { id: doc.id, ...doc.data() });
      });

      const todaysData = dailyDocSnap.exists() ? dailyDocSnap.data() : {};
      const batch = writeBatch(db);
      
      const tomorrowDocRef = doc(db, 'dailyInventory', tomorrow);
      const newDailyData: { [key: string]: any } = {};

      // Iterate over the master inventory to ensure all items are carried over
      for (const [itemId, masterItem] of masterInventory.entries()) {
          const todayItem = todaysData[itemId];
          let closingStock = masterItem.prevStock ?? 0;

          if (todayItem) {
              const opening = (todayItem.prevStock ?? masterItem.prevStock ?? 0) + (todayItem.added ?? 0);
              closingStock = opening - (todayItem.sales ?? 0);
          }

          newDailyData[itemId] = {
            brand: masterItem.brand,
            size: masterItem.size,
            category: masterItem.category,
            price: masterItem.price,
            prevStock: closingStock,
            added: 0, 
            sales: 0,
            opening: closingStock,
            closing: closingStock,
          };
          
          const masterInventoryRef = doc(db, 'inventory', itemId);
          batch.update(masterInventoryRef, { prevStock: closingStock });
      }
      
      batch.set(tomorrowDocRef, newDailyData);

      await batch.commit();

    } catch (error) {
      console.error("Error during end of day process: ", error);
      throw error;
    } finally {
      setIsEndingDay(false);
    }
  };

  return { isEndingDay, endOfDayProcess };
}
