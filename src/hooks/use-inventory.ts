
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
  serverTimestamp,
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

  // This effect sets up the listener for the daily inventory data
  useEffect(() => {
    setLoading(true);
    const dailyDocRef = doc(db, 'dailyInventory', today);

    const unsubscribe = onSnapshot(dailyDocRef, async (dailySnap) => {
        const dailyData = dailySnap.exists() ? dailySnap.data() : {};
        
        // Fetch all master inventory items
        const inventorySnapshot = await getDocs(collection(db, 'inventory'));
        const masterInventory = new Map<string, any>();
        inventorySnapshot.forEach(doc => {
            masterInventory.set(doc.id, { id: doc.id, ...doc.data() });
        });

        // Fetch yesterday's closing stock for calculating prevStock
        const yesterdayDocRef = doc(db, 'dailyInventory', yesterday);
        const yesterdayDocSnap = await getDoc(yesterdayDocRef);
        const yesterdayData = yesterdayDocSnap.exists() ? yesterdayDocSnap.data() : {};

        const items: InventoryItem[] = [];
        masterInventory.forEach((masterItem) => {
            const id = masterItem.id;
            const dailyItem = dailyData[id];
            
            if (dailyItem) {
                items.push({ ...masterItem, ...dailyItem });
            } else {
                // If no record for today, create one based on yesterday or master
                const prevStock = yesterdayData[id]?.closing ?? masterItem.prevStock ?? 0;
                items.push({
                    ...masterItem,
                    prevStock,
                    added: 0,
                    sales: 0,
                });
            }
        });

        setInventory(items.sort((a, b) => a.brand.localeCompare(b.brand)));
        setLoading(false);
    });

    return () => unsubscribe();
  }, [today, yesterday]);
  

  const addBrand = async (newItemData: Omit<InventoryItem, 'id' | 'added' | 'sales' | 'opening' | 'closing'>) => {
    setSaving(true);
    try {
        const id = generateProductId(newItemData.brand, newItemData.size);
        const docRef = doc(db, 'inventory', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            throw new Error(`Product ${newItemData.brand} (${newItemData.size}) already exists.`);
        }
        
        const masterItemData = {
            brand: newItemData.brand,
            size: newItemData.size,
            price: newItemData.price,
            category: newItemData.category,
            prevStock: newItemData.prevStock,
        }

        // Set master record
        await setDoc(docRef, masterItemData);
        
        // Set today's daily record
        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailyItemData = {
            ...masterItemData,
            added: 0,
            sales: 0,
            opening: newItemData.prevStock,
            closing: newItemData.prevStock,
            prevStock: newItemData.prevStock,
        };
        await setDoc(dailyDocRef, { [id]: dailyItemData }, { merge: true });

    } finally {
        setSaving(false);
    }
  };

  const updateBrand = async (id: string, data: Partial<Omit<InventoryItem, 'id'>>) => {
    setSaving(true);
    try {
        const batch = writeBatch(db);

        const docRef = doc(db, 'inventory', id);
        batch.update(docRef, data);
        
        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailyDocSnap = await getDoc(dailyDocRef); // Use getDoc instead of transaction.get
        if (dailyDocSnap.exists()) {
            const dailyData = dailyDocSnap.data();
            if (dailyData[id]) {
                const updatedDailyItem = { ...dailyData[id], ...data };
                batch.set(dailyDocRef, { [id]: updatedDailyItem }, { merge: true });
            }
        }
        await batch.commit();
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
                // This is a Firestore trick to delete a field within a document
                const { [id]: _, ...rest } = dailyData;
                batch.set(dailyDocRef, rest);
            }
        }
        
        await batch.commit();

     } finally {
         setSaving(false);
     }
  };
  
  const updateItemField = async (id: string, field: 'added' | 'sales' | 'price' | 'size', value: number | string) => {
      setSaving(true);
      try {
        await runTransaction(db, async (transaction) => {
            const dailyDocRef = doc(db, 'dailyInventory', today);
            const dailyDocSnap = await transaction.get(dailyDocRef);
            const dailyData = dailyDocSnap.exists() ? dailyDocSnap.data() : {};
            const currentItem = dailyData[id];
            
            if (!currentItem) {
                // This can happen if the item was just added. Let's get it from master.
                const masterRef = doc(db, 'inventory', id);
                const masterSnap = await transaction.get(masterRef);
                if (!masterSnap.exists()) throw new Error("Item does not exist.");

                const yesterdayDocRef = doc(db, 'dailyInventory', yesterday);
                const yesterdaySnap = await transaction.get(yesterdayDocRef);
                const yesterdayData = yesterdaySnap.exists() ? yesterdaySnap.data() : {};
                
                const masterData = masterSnap.data();
                dailyData[id] = {
                    ...masterData,
                    prevStock: yesterdayData[id]?.closing ?? masterData.prevStock ?? 0,
                    added: 0,
                    sales: 0
                };
            }

            const originalValue = dailyData[id][field] || 0;
            dailyData[id][field] = value;

            // If "added" changed, update godown
            if (field === 'added') {
                const difference = (value as number) - originalValue;
                if (difference !== 0) {
                    const godownItemRef = doc(db, 'godownInventory', id);
                    const godownDoc = await transaction.get(godownItemRef);
                    const godownQuantity = godownDoc.exists() ? godownDoc.data().quantity : 0;
                    const newGodownQuantity = godownQuantity - difference;
                    
                    if(newGodownQuantity < 0) {
                        throw new Error(`Not enough stock in godown for ${id}. Available: ${godownQuantity}, Tried to use: ${difference}.`);
                    }
                    
                    if (godownDoc.exists()) {
                        transaction.update(godownItemRef, { quantity: newGodownQuantity });
                    } else if (newGodownQuantity > 0) {
                        // This case handles returning stock to a godown item that was deleted
                        transaction.set(godownItemRef, {
                            ...dailyData[id], // use daily data as a base
                            quantity: newGodownQuantity
                        });
                    }
                }
            }

            // Recalculate opening and closing
            dailyData[id].opening = (dailyData[id].prevStock || 0) + (dailyData[id].added || 0);
            dailyData[id].closing = dailyData[id].opening - (dailyData[id].sales || 0);

            transaction.set(dailyDocRef, dailyData);
        });

      } catch (error) {
        console.error(`Error updating ${field}:`, error);
        throw error;
      } finally {
        setSaving(false);
      }
  };


  return { inventory, setInventory, loading, saving, addBrand, deleteBrand, updateBrand, updateItemField };
}

    