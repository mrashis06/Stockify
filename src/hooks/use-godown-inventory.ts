

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
  arrayUnion,
  limit
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { usePageLoading } from './use-loading';

export type TransferHistory = {
  date: Timestamp;
  quantity: number;
  batchId: string; // Add batchId to track origin
};

export type GodownItem = {
  id: string;
  productId: string; // This is a temporary ID for grouping in godown
  brand: string;
  size: string;
  category: string;
  quantity: number;
  dateAdded: Timestamp;
};

export type ExtractedItem = {
    brand: string;
    size: string;
    quantity: number;
    category: string;
}

// Simple, predictable ID for godown grouping. Not used for main inventory.
const generateGodownProductId = (brand: string, size: string) => {
    const brandPart = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sizePart = size.toLowerCase().replace(/[^0-9]/g, '');
    return `${brandPart}_${sizePart}`;
}


export function useGodownInventory() {
  const [godownInventory, setGodownInventory] = useState<GodownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
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


  const addGodownItem = async (newItemData: Omit<GodownItem, 'id' | 'productId' | 'dateAdded'>) => {
    setSaving(true);
    try {
        const productId = generateGodownProductId(newItemData.brand, newItemData.size);
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
  
  const addMultipleGodownItems = async (items: ExtractedItem[]): Promise<{ addedCount: number, skippedCount: number }> => {
      if (items.length === 0) return { addedCount: 0, skippedCount: 0 };
      setSaving(true);
      let addedCount = 0;
      let skippedCount = 0;

      try {
        const batch = writeBatch(db);
        const godownRef = collection(db, 'godownInventory');
        
        for (const item of items) {
            const productId = generateGodownProductId(item.brand, item.size);
            const docRef = doc(godownRef);
            batch.set(docRef, {
                ...item,
                productId,
                dateAdded: serverTimestamp(),
            });
            addedCount++;
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
        console.error("Error deleting godown item:", error);
        throw error;
     } finally {
         setSaving(false);
     }
  };

  const deleteGodownProduct = async (productId: string) => {
    setSaving(true);
    try {
      const q = query(collection(db, "godownInventory"), where("productId", "==", productId));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error deleting godown product:", error);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const transferToShop = async (productId: string, quantityToTransfer: number, barcodeId: string, price?: number) => {
    setSaving(true);
    const today = format(new Date(), 'yyyy-MM-dd');
  
    // READS OUTSIDE TRANSACTION
    const godownItemsQuery = query(collection(db, 'godownInventory'), where('productId', '==', productId));
    const godownItemsSnapshot = await getDocs(godownItemsQuery);
  
    if (godownItemsSnapshot.empty) {
      setSaving(false);
      throw new Error(`Product not found in godown.`);
    }
  
    const sortedGodownItems = godownItemsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as GodownItem))
      .sort((a, b) => (a.dateAdded?.toMillis() ?? 0) - (b.dateAdded?.toMillis() ?? 0));
  
    const totalGodownStock = sortedGodownItems.reduce((sum, item) => sum + item.quantity, 0);
  
    if (totalGodownStock < quantityToTransfer) {
      setSaving(false);
      throw new Error(`Not enough stock in godown. Available: ${totalGodownStock}`);
    }
  
    try {
      await runTransaction(db, async (transaction) => {
        // --- ALL READS FIRST ---
        const inventoryQuery = query(collection(db, 'inventory'), where('barcodeId', '==', barcodeId), limit(1));
        const inventorySnap = await getDocs(inventoryQuery);
        const shopItemDoc = !inventorySnap.empty ? inventorySnap.docs[0] : null;

        const dailyInventoryRef = doc(db, 'dailyInventory', today);
        const dailyDoc = await transaction.get(dailyInventoryRef);
        const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
  
        // --- ALL WRITES LAST ---
        let shopItemId: string;
        let shopItemRef;
        const isNewProduct = !shopItemDoc;
        const { brand, size, category } = sortedGodownItems[0];
  
        if (isNewProduct) {
          if (price === undefined) throw new Error("Price is required for new products.");
          
          shopItemId = barcodeId; 
          shopItemRef = doc(db, 'inventory', shopItemId);
          
          const newShopItemData = {
            brand, size, category, price,
            prevStock: 0,
            transferHistory: [],
            barcodeId,
          };
          transaction.set(shopItemRef, newShopItemData);
        } else {
          shopItemId = shopItemDoc.id;
          shopItemRef = shopItemDoc.ref;
        }

        let remainingToTransfer = quantityToTransfer;
        const transferTimestamp = Timestamp.now();
  
        for (const batchData of sortedGodownItems) {
          if (remainingToTransfer <= 0) break;
  
          const batchRef = doc(db, 'godownInventory', batchData.id);
          const transferAmount = Math.min(batchData.quantity, remainingToTransfer);
  
          const newHistoryEntry: TransferHistory = {
            date: transferTimestamp,
            quantity: transferAmount,
            batchId: batchData.id,
          };
  
          if (batchData.quantity - transferAmount <= 0) {
            transaction.delete(batchRef);
          } else {
            transaction.update(batchRef, {
              quantity: batchData.quantity - transferAmount,
            });
          }
  
          transaction.update(shopItemRef, { transferHistory: arrayUnion(newHistoryEntry) });
          remainingToTransfer -= transferAmount;
        }
  
        let currentDailyItem = dailyData[shopItemId];
  
        if (!currentDailyItem) {
          const itemPrice = isNewProduct ? price : shopItemDoc?.data()?.price ?? 0;
          currentDailyItem = {
            brand, size, category,
            price: itemPrice,
            added: 0,
            sales: 0,
          };
        }
  
        currentDailyItem.added = (currentDailyItem.added || 0) + quantityToTransfer;
        transaction.set(dailyInventoryRef, { [shopItemId]: currentDailyItem }, { merge: true });
      });
  
    } catch (error) {
      console.error("Error transferring stock to shop: ", error);
      throw error;
    } finally {
      setSaving(false);
    }
  };


  return { godownInventory, loading, saving, addGodownItem, addMultipleGodownItems, updateGodownItem, deleteGodownItem, deleteGodownProduct, transferToShop, forceRefetch: fetchGodownInventory };
}
