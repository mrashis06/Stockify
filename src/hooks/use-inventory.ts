
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
  runTransaction,
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
        await runTransaction(db, async (transaction) => {
            const dailyDocRef = doc(db, 'dailyInventory', today);
            const dailyDocSnap = await transaction.get(dailyDocRef);
            const persistedDailyData = dailyDocSnap.exists() ? dailyDocSnap.data() : {};
            const godownUpdateMap: Map<string, number> = new Map();

            // Prepare daily data and calculate godown updates
            const newDailyData: { [key: string]: any } = {};
            for (const item of inventory) {
                const persistedAdded = persistedDailyData[item.id]?.added ?? 0;
                const newAdded = item.added ?? 0;
                const addedDifference = newAdded - persistedAdded;

                if (addedDifference !== 0) {
                    godownUpdateMap.set(item.id, addedDifference);
                }

                const opening = (item.prevStock ?? 0) + (item.added ?? 0);
                const closing = opening - (item.sales ?? 0);
                
                newDailyData[item.id] = {
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
            }

            // Read godown items that need updating
            for (const [id, difference] of godownUpdateMap.entries()) {
                const godownItemRef = doc(db, 'godownInventory', id);
                const godownItemDoc = await transaction.get(godownItemRef);

                if (!godownItemDoc.exists() && difference > 0) {
                    throw new Error(`Item ${id} not found in godown, but trying to decrease stock.`);
                }
                
                const currentQuantity = godownItemDoc.exists() ? godownItemDoc.data().quantity : 0;
                const newQuantity = currentQuantity - difference;

                if (newQuantity < 0) {
                    throw new Error(`Not enough stock in godown for ${id}. Available: ${currentQuantity}, Tried to transfer: ${difference}.`);
                }
                // The actual update is done in the next loop to keep reads and writes separate
            }

            // Perform all writes
            // 1. Update godown inventory
            for (const [id, difference] of godownUpdateMap.entries()) {
                const godownItemRef = doc(db, 'godownInventory', id);
                 const godownItemDoc = await transaction.get(godownItemRef); // re-get for safety, though not strictly needed here.
                 const currentQuantity = godownItemDoc.exists() ? godownItemDoc.data().quantity : 0;
                 const newQuantity = currentQuantity - difference;
                 
                if (godownItemDoc.exists()) {
                    transaction.update(godownItemRef, { quantity: newQuantity });
                } else {
                    // This case should ideally not be hit if we only allow adding from godown transfer
                    // But as a fallback, we can create it. Let's assume brand/size/cat would need to be known.
                    // For now, we'll rely on the error thrown above.
                }
            }
            
            // 2. Update daily inventory
            transaction.set(dailyDocRef, newDailyData);
        });
    } catch (error) {
      console.error("Error saving inventory changes: ", error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return { inventory, setInventory, loading, saving, addBrand, deleteBrand, updateBrand, saveChanges };
}
