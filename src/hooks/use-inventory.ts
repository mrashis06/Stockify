
"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, subDays } from 'date-fns';

export type InventoryItem = {
  id: string;
  brand: string;
  size: string;
  price: number;
  category: string;
  prevStock: number;
  added: number;
  sales: number;
  opening?: number;
  closing?: number;
};

// Generates a Firestore-safe ID from brand and size
const generateProductId = (brand: string, size: string) => {
    const brandFormatted = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sizeFormatted = size.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${brandFormatted}_${sizeFormatted}`;
}

export function useInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const fetchInventoryData = useCallback(async () => {
    setLoading(true);
    try {
        const inventorySnapshot = await getDocs(collection(db, 'inventory'));
        const yesterdayDocRef = doc(db, 'dailyInventory', yesterday);
        const yesterdayDocSnap = await getDoc(yesterdayDocRef);
        const yesterdayData = yesterdayDocSnap.exists() ? yesterdayDocSnap.data() : {};

        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailyDocSnap = await getDoc(dailyDocRef);
        const dailyData = dailyDocSnap.exists() ? dailyDocSnap.data() : null;

        const items: InventoryItem[] = [];
        inventorySnapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id;

            if (dailyData && dailyData[id]) {
                // If today's data exists, use it
                items.push({ id, ...dailyData[id] });
            } else {
                // Otherwise, calculate from yesterday's closing
                const prevStock = yesterdayData[id]?.closing ?? data.prevStock ?? 0;
                items.push({
                    ...data,
                    id,
                    prevStock,
                    added: 0,
                    sales: 0,
                } as InventoryItem);
            }
        });
         setInventory(items);

    } catch (error) {
        console.error("Error fetching inventory data: ", error);
    } finally {
        setLoading(false);
    }
  }, [today, yesterday]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "inventory"), (snapshot) => {
        fetchInventoryData();
    });
    return () => unsubscribe();
  }, [fetchInventoryData]);


  const addBrand = async (newItemData: Omit<InventoryItem, 'id' | 'added' | 'sales' | 'opening' | 'closing'>) => {
    setSaving(true);
    try {
        const id = generateProductId(newItemData.brand, newItemData.size);
        const docRef = doc(db, 'inventory', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            throw new Error(`Product ${newItemData.brand} (${newItemData.size}) already exists.`);
        }
        
        const fullItemData: Omit<InventoryItem, 'id'> = {
            ...newItemData,
            added: 0,
            sales: 0,
            opening: newItemData.prevStock,
            closing: newItemData.prevStock
        }

        await setDoc(docRef, fullItemData);

    } finally {
        setSaving(false);
    }
  };

  const updateBrand = async (id: string, data: Partial<Omit<InventoryItem, 'id'>>) => {
    setSaving(true);
    try {
        const docRef = doc(db, 'inventory', id);
        await updateDoc(docRef, data);
        
        // Also update in today's daily record if it exists
        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailyDocSnap = await getDoc(dailyDocRef);
        if (dailyDocSnap.exists()) {
            const dailyData = dailyDocSnap.data();
            if (dailyData[id]) {
                const updatedDailyItem = { ...dailyData[id], ...data };
                await setDoc(dailyDocRef, { [id]: updatedDailyItem }, { merge: true });
            }
        }

    } catch (error) {
      console.error("Error updating brand: ", error);
      throw error;
    } finally {
        setSaving(false);
    }
  };

  const deleteBrand = async (id: string) => {
     setSaving(true);
     try {
        const batch = writeBatch(db);
        
        const inventoryDocRef = doc(db, 'inventory', id);
        batch.delete(inventoryDocRef);

        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailyDocSnap = await getDoc(dailyDocRef);
        if (dailyDocSnap.exists()) {
            const dailyData = dailyDocSnap.data();
            if(dailyData[id]) {
                delete dailyData[id];
                batch.set(dailyDocRef, dailyData);
            }
        }
        
        await batch.commit();

     } finally {
         setSaving(false);
     }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      const dailyData: { [key: string]: any } = {};

      inventory.forEach(item => {
        const opening = (item.prevStock ?? 0) + (item.added ?? 0);
        const closing = opening - (item.sales ?? 0);
        
        // This is a snapshot of the item's state at the time of saving
        const savedItemState = {
          brand: item.brand,
          size: item.size,
          price: item.price,
          category: item.category,
          prevStock: item.prevStock,
          added: item.added,
          sales: item.sales,
          opening,
          closing,
        };
        
        dailyData[item.id] = savedItemState;
      });

      const dailyDocRef = doc(db, 'dailyInventory', today);
      batch.set(dailyDocRef, dailyData); // Using set to overwrite the whole day's data for consistency

      await batch.commit();
    } catch (error) {
      console.error("Error saving inventory changes: ", error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return { inventory, setInventory, loading, saving, addBrand, deleteBrand, updateBrand, saveChanges };
}

    
    