
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
        // 1. Check for today's daily record
        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailyDocSnap = await getDoc(dailyDocRef);

        let items: InventoryItem[] = [];

        if (dailyDocSnap.exists()) {
            // Load from today's record
            const dailyData = dailyDocSnap.data();
            for (const id in dailyData) {
                const item = dailyData[id];
                items.push({ id, ...item });
            }
        } else {
            // Load from main inventory and yesterday's closing
            const inventorySnapshot = await getDocs(collection(db, 'inventory'));
            const yesterdayDocRef = doc(db, 'dailyInventory', yesterday);
            const yesterdayDocSnap = await getDoc(yesterdayDocRef);
            const yesterdayData = yesterdayDocSnap.exists() ? yesterdayDocSnap.data() : {};

            inventorySnapshot.forEach(doc => {
                const data = doc.data();
                const id = doc.id;
                const prevStock = yesterdayData[id]?.closing ?? data.prevStock ?? 0;
                items.push({
                    ...data,
                    id,
                    prevStock,
                    added: 0,
                    sales: 0,
                } as InventoryItem);
            });
        }
         setInventory(items);

    } catch (error) {
        console.error("Error fetching inventory data: ", error);
    } finally {
        setLoading(false);
    }
  }, [today, yesterday]);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);


  // Listen for real-time updates on the main inventory to catch new brands
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "inventory"), (snapshot) => {
        // This is a simple way to refresh if something changed externally
        // A more sophisticated approach might merge changes
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

        const batch = writeBatch(db);
        batch.set(docRef, fullItemData);

        // Also update today's daily record if it exists
        const dailyDocRef = doc(db, 'dailyInventory', today);
        batch.set(dailyDocRef, { [id]: fullItemData }, { merge: true });

        await batch.commit();

        // Add to local state
        setInventory(prev => [...prev, { ...fullItemData, id }]);

    } finally {
        setSaving(false);
    }
  };

  const deleteBrand = async (id: string) => {
     setSaving(true);
     try {
        const batch = writeBatch(db);
        
        // Delete from main inventory
        const inventoryDocRef = doc(db, 'inventory', id);
        batch.delete(inventoryDocRef);

        // Remove from today's daily record
        const dailyDocRef = doc(db, 'dailyInventory', today);
        // Firestore doesn't support deleting nested fields with a specific value in a batch,
        // so we have to read, modify, and then write.
        const dailyDocSnap = await getDoc(dailyDocRef);
        if (dailyDocSnap.exists()) {
            const dailyData = dailyDocSnap.data();
            delete dailyData[id];
            batch.set(dailyDocRef, dailyData);
        }
        
        await batch.commit();

        // Remove from local state
        setInventory(prev => prev.filter(item => item.id !== id));
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

        // Prepare data for the 'inventory' collection
        // Here we persist the latest closing stock as the new prevStock for the next day.
        const inventoryDocRef = doc(db, 'inventory', item.id);
        batch.update(inventoryDocRef, { 
            ...updatedItem,
            prevStock: closing // IMPORTANT: Today's closing is tomorrow's opening
        });

        // Prepare data for the 'dailyInventory' collection
        dailyData[item.id] = updatedItem;
      });

      const dailyDocRef = doc(db, 'dailyInventory', today);
      batch.set(dailyDocRef, dailyData);

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
