
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
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, subDays } from 'date-fns';
import { usePageLoading } from './use-loading';

export type GodownItem = {
  id: string;
  productId: string;
  brand: string;
  size: string;
  category: string;
  quantity: number;
  dateAdded: Timestamp;
  dateTransferred?: Timestamp;
};

// Generates a Firestore-safe ID from brand and size for grouping
const generateProductId = (brand: string, size: string) => {
    const brandFormatted = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sizeFormatted = size.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${brandFormatted}_${sizeFormatted}`;
}

export function useGodownInventory() {
  const [godownInventory, setGodownInventory] = useState<GodownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  usePageLoading(loading);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "godownInventory"), orderBy("dateAdded", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const items: GodownItem[] = [];
        snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() } as GodownItem);
        });
        setGodownInventory(items);
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);


  const addGodownItem = async (newItemData: Omit<GodownItem, 'id' | 'productId' | 'dateAdded' | 'dateTransferred'>) => {
    setSaving(true);
    try {
        const productId = generateProductId(newItemData.brand, newItemData.size);
        const docRef = collection(db, 'godownInventory');
        
        await addDoc(docRef, {
            ...newItemData,
            productId: productId,
            dateAdded: serverTimestamp(),
        });

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

  const transferToShop = async (productId: string, quantityToTransfer: number) => {
    setSaving(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    
    try {
        await runTransaction(db, async (transaction) => {
            const godownItemsQuery = query(
                collection(db, 'godownInventory'),
                where('productId', '==', productId)
            );
            
            const godownItemsSnapshot = await getDocs(godownItemsQuery);
            const godownBatches = godownItemsSnapshot.docs
              .map(d => ({ id: d.id, ...d.data() } as GodownItem))
              .sort((a, b) => a.dateAdded.toMillis() - b.dateAdded.toMillis());

            const totalGodownStock = godownBatches.reduce((sum, batch) => sum + batch.quantity, 0);

            if (totalGodownStock < quantityToTransfer) {
                throw new Error(`Not enough stock in godown. Available: ${totalGodownStock}`);
            }

            const shopItemRef = doc(db, 'inventory', productId);
            const dailyInventoryRef = doc(db, 'dailyInventory', today);
            const yesterdayInventoryRef = doc(db, 'dailyInventory', yesterday);

            const shopItemDoc = await transaction.get(shopItemRef);
            const dailyDoc = await transaction.get(dailyInventoryRef);
            const yesterdayDoc = await transaction.get(yesterdayInventoryRef);
            
            let shopItemData: any;

            if (!shopItemDoc.exists()) {
                // If item doesn't exist in master, create it.
                const firstBatch = godownBatches[0];
                shopItemData = {
                    brand: firstBatch.brand,
                    size: firstBatch.size,
                    category: firstBatch.category,
                    price: 0, // Price needs to be set manually
                    prevStock: 0
                };
                transaction.set(shopItemRef, shopItemData);
            } else {
                shopItemData = shopItemDoc.data();
            }


            let remainingToTransfer = quantityToTransfer;

            for (const batch of godownBatches) {
                if (remainingToTransfer <= 0) break;

                const batchRef = doc(db, 'godownInventory', batch.id);
                const transferAmount = Math.min(batch.quantity, remainingToTransfer);

                const updateData: {quantity?: number, dateTransferred: Timestamp} = {
                    dateTransferred: Timestamp.now()
                };

                if (batch.quantity - transferAmount <= 0) {
                    transaction.delete(batchRef);
                } else {
                    updateData.quantity = batch.quantity - transferAmount;
                    transaction.update(batchRef, updateData);
                }

                remainingToTransfer -= transferAmount;
            }
            
            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            const yesterdayData = yesterdayDoc.exists() ? yesterdayDoc.data() : {};
            
            const prevStockFromYesterday = yesterdayData[productId]?.closing ?? shopItemData?.prevStock ?? 0;
            
            const currentDailyItem = dailyData[productId] || {
                 brand: shopItemData.brand,
                 size: shopItemData.size,
                 category: shopItemData.category,
                 price: shopItemData.price,
                 prevStock: prevStockFromYesterday,
                 added: 0,
                 sales: 0,
            };
            
            currentDailyItem.added = (currentDailyItem.added || 0) + quantityToTransfer;
            currentDailyItem.prevStock = prevStockFromYesterday; 

            currentDailyItem.opening = currentDailyItem.prevStock + (currentDailyItem.added || 0);
            currentDailyItem.closing = currentDailyItem.opening - (currentDailyItem.sales || 0);
            
            transaction.set(dailyInventoryRef, { [productId]: currentDailyItem }, { merge: true });
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
