
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

export type GodownItem = {
  id: string;
  brand: string;
  size: string;
  category: string;
  quantity: number;
};

// Generates a Firestore-safe ID from brand and size
const generateProductId = (brand: string, size: string) => {
    const brandFormatted = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sizeFormatted = size.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${brandFormatted}_${sizeFormatted}`;
}

export function useGodownInventory() {
  const [godownInventory, setGodownInventory] = useState<GodownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "godownInventory"), (snapshot) => {
        const items: GodownItem[] = [];
        snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() } as GodownItem);
        });
        setGodownInventory(items);
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);


  const addGodownItem = async (newItemData: Omit<GodownItem, 'id'>) => {
    setSaving(true);
    try {
        const id = generateProductId(newItemData.brand, newItemData.size);
        const docRef = doc(db, 'godownInventory', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // If item exists, just update the quantity
            const existingData = docSnap.data() as GodownItem;
            await updateDoc(docRef, {
                quantity: existingData.quantity + newItemData.quantity
            });
        } else {
            // Otherwise, create a new item
            await setDoc(docRef, { ...newItemData, id });
        }

    } catch (error) {
        console.error("Error adding godown item: ", error);
        throw error;
    } finally {
        setSaving(false);
    }
  };

  const updateGodownItem = async (id: string, data: Partial<Omit<GodownItem, 'id'>>) => {
    setSaving(true);
    try {
        const docRef = doc(db, 'godownInventory', id);
        await updateDoc(docRef, data);
    } catch (error) {
      console.error("Error updating godown item: ", error);
      throw error;
    } finally {
        setSaving(false);
    }
  };

  const deleteGodownItem = async (id: string) => {
     setSaving(true);
     try {
        const docRef = doc(db, 'godownInventory', id);
        await deleteDoc(docRef);
     } catch (error) {
        console.error("Error deleting godown item: ", error);
        throw error;
     } finally {
         setSaving(false);
     }
  };

  const transferToShop = async (itemId: string, quantity: number) => {
    setSaving(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    
    try {
        await runTransaction(db, async (transaction) => {
            // --- READS FIRST ---
            const godownItemRef = doc(db, 'godownInventory', itemId);
            const shopItemRef = doc(db, 'inventory', itemId);
            const dailyInventoryRef = doc(db, 'dailyInventory', today);
            const yesterdayInventoryRef = doc(db, 'dailyInventory', yesterday);

            const godownItemDoc = await transaction.get(godownItemRef);
            const shopItemDoc = await transaction.get(shopItemRef);
            const dailyDoc = await transaction.get(dailyInventoryRef);
            const yesterdayDoc = await transaction.get(yesterdayInventoryRef);

            // --- VALIDATION & PREPARATION ---
            if (!godownItemDoc.exists()) {
                throw new Error("Item not found in godown.");
            }
            const godownItem = godownItemDoc.data() as GodownItem;
            if (godownItem.quantity < quantity) {
                throw new Error(`Not enough stock in godown. Available: ${godownItem.quantity}`);
            }

            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            
            // --- WRITES LAST ---

            // 1. Ensure item exists in the main shop inventory
            if (!shopItemDoc.exists()) {
                const newItemForShop = {
                    brand: godownItem.brand,
                    size: godownItem.size,
                    category: godownItem.category,
                    price: 0, // Default price, should be updated by user in inventory page
                    prevStock: 0,
                    added: 0,
                    sales: 0,
                };
                transaction.set(shopItemRef, newItemForShop);
            }
            
            // 2. Update godown stock
            const newGodownQuantity = godownItem.quantity - quantity;
            transaction.update(godownItemRef, { quantity: newGodownQuantity });

            // 3. Update today's daily inventory record
            const shopData = shopItemDoc.exists() ? shopItemDoc.data() : { price: 0 };
            
            // Correctly determine previous stock from yesterday's daily record, or the master record.
            const yesterdayData = yesterdayDoc.exists() ? yesterdayDoc.data() : {};
            const prevStockFromYesterday = yesterdayData[itemId]?.closing ?? shopData?.prevStock ?? 0;
            
            const currentDailyItem = dailyData[itemId] || {
                 brand: godownItem.brand,
                 size: godownItem.size,
                 category: godownItem.category,
                 price: shopData.price,
                 prevStock: prevStockFromYesterday,
                 added: 0,
                 sales: 0
            };
            
            currentDailyItem.added = (currentDailyItem.added || 0) + quantity;
            currentDailyItem.prevStock = prevStockFromYesterday; // Ensure this is always set

            // Recalculate opening and closing stock
            currentDailyItem.opening = currentDailyItem.prevStock + currentDailyItem.added;
            currentDailyItem.closing = currentDailyItem.opening - (currentDailyItem.sales || 0);
            
            transaction.set(dailyInventoryRef, { [itemId]: currentDailyItem }, { merge: true });
        });

    } catch (error) {
        console.error("Error transferring stock to shop: ", error);
        throw error;
    } finally {
        setSaving(false);
    }
  };


  return { godownInventory, loading, saving, addGodownItem, updateGodownItem, deleteGodownItem, transferToShop };
}
