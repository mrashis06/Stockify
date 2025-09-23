
"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  addDoc,
  deleteDoc,
  onSnapshot,
  setDoc,
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
            delete dailyData[id];
            batch.set(dailyDocRef, dailyData);
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
        
        const updatedItem = {
          ...item,
          opening,
          closing,
        };
        
        dailyData[item.id] = updatedItem;
      });

      const dailyDocRef = doc(db, 'dailyInventory', today);
      batch.set(dailyDocRef, dailyData, { merge: true });

      await batch.commit();
    } catch (error) {
      console.error("Error saving inventory changes: ", error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return { inventory, setInventory, loading, saving, addBrand, deleteBrand, saveChanges };
}
