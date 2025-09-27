
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
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, subDays } from 'date-fns';
import { usePageLoading } from './use-loading';

export type TransferHistory = {
  date: Timestamp;
  quantity: number;
  batchId: string; // Add batchId to track origin
};

export type GodownItem = {
  id: string;
  productId: string;
  brand: string;
  size: string;
  category: string;
  quantity: number;
  dateAdded: Timestamp;
  transferHistory?: TransferHistory[];
};

export type ExtractedItem = {
    brand: string;
    size: string;
    quantity: number;
    category: string;
}

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
  
  // This hook now connects the component's loading state to the global loader
  usePageLoading(loading);

  const fetchGodownInventory = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "godownInventory"), orderBy("dateAdded", "asc"));
      const snapshot = await getDocs(q);
      const items: GodownItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as GodownItem);
      });
      setGodownInventory(items);
    } catch(e) {
      console.error("Error fetching godown inventory:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, "godownInventory"), orderBy("dateAdded", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const items: GodownItem[] = [];
        snapshot.forEach((doc) => {
            items.push({ id: doc.id, ...doc.data() } as GodownItem);
        });
        setGodownInventory(items);
        setLoading(false);
    }, (error) => {
        console.error("Godown inventory listener error:", error);
        setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);


  const addGodownItem = async (newItemData: Omit<GodownItem, 'id' | 'productId' | 'dateAdded' | 'transferHistory'>) => {
    setSaving(true);
    try {
        const productId = generateProductId(newItemData.brand, newItemData.size);
        const docRef = collection(db, 'godownInventory');
        
        await addDoc(docRef, {
            ...newItemData,
            productId: productId,
            dateAdded: serverTimestamp(),
            transferHistory: [],
        });

    } catch (error) {
        console.error("Error adding godown item: ", error);
        throw error;
    } finally {
        setSaving(false);
    }
  };
  
  const addMultipleGodownItems = async (items: ExtractedItem[]): Promise<{ addedCount: number, skippedCount: number }> => {
      if (items.length === 0) return { addedCount: 0, skippedCount: 0 };
      setSaving(true);
      let addedCount = 0;
      let skippedCount = 0;

      try {
        const batch = writeBatch(db);
        const godownRef = collection(db, 'godownInventory');
        
        // Fetch existing product IDs to check against
        const existingProductIds = new Set(godownInventory.map(item => item.productId));

        for (const item of items) {
            const productId = generateProductId(item.brand, item.size);

            if (existingProductIds.has(productId)) {
                skippedCount++;
                continue; // Skip this item as it already exists
            }

            const docRef = doc(godownRef);
            batch.set(docRef, {
                ...item,
                productId,
                dateAdded: serverTimestamp(),
                transferHistory: [],
            });
            addedCount++;
            existingProductIds.add(productId); // Add to set to prevent duplicates from the same bill
        }
        
        if (addedCount > 0) {
            await batch.commit();
        }
        
        return { addedCount, skippedCount };

      } catch(e) {
          console.error("Error adding multiple godown items:", e);
          throw e;
      } finally {
          setSaving(false);
      }
  }

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
            const sortedGodownItems = godownItemsSnapshot.docs.sort(
                (a, b) => a.data().dateAdded.toMillis() - b.data().dateAdded.toMillis()
            );

            const totalGodownStock = sortedGodownItems.reduce((sum, doc) => sum + doc.data().quantity, 0);

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
                const firstBatch = sortedGodownItems[0].data();
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
            const transferTimestamp = Timestamp.now();

            for (const docSnap of sortedGodownItems) {
                if (remainingToTransfer <= 0) break;
                
                const batch = { id: docSnap.id, ...docSnap.data() } as GodownItem;
                const batchRef = doc(db, 'godownInventory', batch.id);
                const transferAmount = Math.min(batch.quantity, remainingToTransfer);

                const newHistoryEntry: TransferHistory = {
                    date: transferTimestamp,
                    quantity: transferAmount,
                    batchId: batch.id,
                };
                
                if (batch.quantity - transferAmount <= 0) {
                    // If the entire batch is used, delete it but keep its history in the log
                    transaction.delete(batchRef);
                } else {
                    transaction.update(batchRef, {
                        quantity: batch.quantity - transferAmount,
                        transferHistory: arrayUnion(newHistoryEntry)
                    });
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
            
            transaction.set(dailyInventoryRef, { [productId]: currentDailyItem }, { merge: true });
        });

    } catch (error) {
        console.error("Error transferring stock to shop: ", error);
        throw error;
    } finally {
        setSaving(false);
    }
  };


  return { godownInventory, loading, saving, addGodownItem, addMultipleGodownItems, updateGodownItem, deleteGodownItem, transferToShop, forceRefetch: fetchGodownInventory };
}

    
