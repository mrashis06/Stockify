
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
import { format } from 'date-fns';

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
            await setDoc(docRef, newItemData);
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
    
    try {
        await runTransaction(db, async (transaction) => {
            const godownItemRef = doc(db, 'godownInventory', itemId);
            const shopItemRef = doc(db, 'inventory', itemId);
            const dailyInventoryRef = doc(db, 'dailyInventory', today);

            // 1. Get godown item and check stock
            const godownItemDoc = await transaction.get(godownItemRef);
            if (!godownItemDoc.exists()) {
                throw new Error("Item not found in godown.");
            }
            const godownItem = godownItemDoc.data() as GodownItem;
            if (godownItem.quantity < quantity) {
                throw new Error(`Not enough stock in godown. Available: ${godownItem.quantity}`);
            }

            // 2. Ensure item exists in the main shop inventory
            const shopItemDoc = await transaction.get(shopItemRef);
            if (!shopItemDoc.exists()) {
                // If it doesn't exist in the shop inventory, create it.
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

            // 3. Update godown stock
            const newGodownQuantity = godownItem.quantity - quantity;
            transaction.update(godownItemRef, { quantity: newGodownQuantity });

            // 4. Update today's daily inventory record
            const dailyDoc = await transaction.get(dailyInventoryRef);
            let dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            
            const currentDailyItem = dailyData[itemId] || {
                 brand: godownItem.brand,
                 size: godownItem.size,
                 category: godownItem.category,
                 price: shopItemDoc.exists() ? shopItemDoc.data().price : 0,
                 prevStock: 0,
                 added: 0,
                 sales: 0
            };
            
            currentDailyItem.added = (currentDailyItem.added || 0) + quantity;

            // Recalculate opening and closing stock
            currentDailyItem.opening = (currentDailyItem.prevStock || 0) + currentDailyItem.added;
            currentDailyItem.closing = currentDailyItem.opening - (currentDailyItem.sales || 0);

            dailyData[itemId] = currentDailyItem;

            transaction.set(dailyInventoryRef, dailyData);
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
