
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
import { toast } from '@/hooks/use-toast';

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
      try {
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
            
            const prevStock = yesterdayData[id]?.closing ?? masterItem.prevStock ?? 0;

            if (dailyItem) {
                // Ensure prevStock from yesterday is correctly assigned
                items.push({ ...masterItem, ...dailyItem, prevStock });
            } else {
                // If no record for today, create one based on yesterday or master
                items.push({
                    ...masterItem,
                    prevStock,
                    added: 0,
                    sales: 0,
                });
            }
        });

        const processedInventory = items.map(item => {
             const opening = (item.prevStock ?? 0) + (item.added ?? 0);
             const closing = opening - (item.sales ?? 0);
             return { ...item, opening, closing };
        });

        setInventory(processedInventory.sort((a, b) => a.brand.localeCompare(b.brand)));
      } catch (error) {
        console.error("Error fetching inventory data: ", error);
        toast({ title: 'Error', description: 'Failed to load inventory data.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
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
        const dailyDocSnap = await getDoc(dailyDocRef);
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
      const originalItemState = inventory.find(item => item.id === id);

      try {
        await runTransaction(db, async (transaction) => {
            const dailyDocRef = doc(db, 'dailyInventory', today);
            const dailyDocSnap = await transaction.get(dailyDocRef);
            let dailyData = dailyDocSnap.exists() ? dailyDocSnap.data() : {};
            
            // Ensure dailyData for the item exists, creating it if necessary
            if (!dailyData[id]) {
                const masterRef = doc(db, 'inventory', id);
                const masterSnap = await transaction.get(masterRef);
                if (!masterSnap.exists()) throw new Error("Item does not exist.");

                const yesterdayDocRef = doc(db, 'dailyInventory', yesterday);
                const yesterdaySnap = await transaction.get(yesterdayDocRef);
                const yesterdayData = yesterdaySnap.exists() ? yesterdaySnap.data() : {};
                
                const masterData = masterSnap.data();
                const prevStock = yesterdayData[id]?.closing ?? masterData.prevStock ?? 0;

                dailyData[id] = {
                    ...masterData,
                    prevStock: prevStock,
                    added: 0,
                    sales: 0
                };
            }

            dailyData[id][field] = value;

             if (field === 'price') {
                const masterRef = doc(db, 'inventory', id);
                transaction.update(masterRef, { price: value });
            }

            // Recalculate opening and closing
            dailyData[id].opening = (dailyData[id].prevStock || 0) + (dailyData[id].added || 0);
            dailyData[id].closing = dailyData[id].opening - (dailyData[id].sales || 0);

            transaction.set(dailyDocRef, dailyData, { merge: true });
        });

      } catch (error) {
        console.error(`Error updating ${field}:`, error);
        // Revert local state on error
        if (originalItemState) {
          setInventory(prev => prev.map(item => item.id === id ? originalItemState : item));
        }
        // Rethrow with a user-friendly message
        throw new Error(`Failed to update ${field}. Please try again.`);
      } finally {
        setSaving(false);
      }
  };


  return { inventory, setInventory, loading, saving, addBrand, deleteBrand, updateBrand, updateItemField };
}
