
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
    // We listen to changes in daily inventory to reflect transfers from godown immediately
    const dailyDocRef = doc(db, 'dailyInventory', today);
    const unsubscribe = onSnapshot(dailyDocRef, (doc) => {
        fetchInventoryData();
    });
    
    // Also listen to master inventory for new brands being added
    const inventoryCollectionRef = collection(db, "inventory");
    const unsubscribeInventory = onSnapshot(inventoryCollectionRef, (snapshot) => {
        fetchInventoryData();
    });
    
    return () => {
        unsubscribe();
        unsubscribeInventory();
    };
  }, [fetchInventoryData, today]);


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
            const godownRefs: { ref: any, difference: number, id: string }[] = [];

            // --- Pass 1: Prepare daily data and identify necessary godown reads ---
            const newDailyData: { [key: string]: any } = {};
            for (const item of inventory) {
                const localAdded = item.added ?? 0;
                const persistedAdded = persistedDailyData[item.id]?.added ?? 0;
                const addedDifference = localAdded - persistedAdded;

                if (addedDifference !== 0) {
                    const godownItemRef = doc(db, 'godownInventory', item.id);
                    godownRefs.push({ ref: godownItemRef, difference: addedDifference, id: item.id });
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
            
            // --- Pass 2: Read from godown within the transaction ---
            const godownDocs = godownRefs.length > 0 
                ? await Promise.all(godownRefs.map(gRef => transaction.get(gRef.ref)))
                : [];

            // --- Pass 3: Perform all writes ---
            // 1. Update godown inventory
            for (let i = 0; i < godownRefs.length; i++) {
                const godownDoc = godownDocs[i];
                const { ref, difference, id } = godownRefs[i];
                
                const currentQuantity = godownDoc.exists() ? godownDoc.data().quantity : 0;
                const newGodownQuantity = currentQuantity - difference;
                
                // For items added to shop from godown, check if godown exists first
                 if (difference > 0 && !godownDoc.exists()) {
                     throw new Error(`Item ${id} does not exist in godown to be transferred from.`);
                 }

                if (newGodownQuantity < 0) {
                    throw new Error(`Not enough stock in godown for ${id}. Available: ${currentQuantity}, Tried to use: ${difference}.`);
                }
                
                 if (godownDoc.exists()) {
                    transaction.update(ref, { quantity: newGodownQuantity });
                } else {
                    // This case should ideally not be hit if we are returning stock,
                    // but as a failsafe we create it.
                    const inventoryItem = inventory.find(inv => inv.id === id);
                    if (inventoryItem) {
                         transaction.set(ref, { 
                            brand: inventoryItem.brand,
                            size: inventoryItem.size,
                            category: inventoryItem.category,
                            quantity: newGodownQuantity 
                        });
                    }
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
