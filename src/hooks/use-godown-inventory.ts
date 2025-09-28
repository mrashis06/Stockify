

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
};

export type ExtractedItem = {
    brand: string;
    size: string;
    quantity: number;
    category: string;
}


// The new, robust "Smart ID" generation function.
const generateProductId = (brand: string, size: string) => {
    // Dictionary for common abbreviations
    const abbreviations: { [key: string]: string } = {
        'mc': 'mcdowells',
        'bp': 'blenderspride',
        'oc': 'officerschoice',
        'ac': 'aristocrat',
        'rc': 'royalchallenge',
        'rs': 'royalspecial',
    };

    // Refined list of "junk" words to be removed.
    // Important identifiers like "strong", "classic", "black", "signature" are NOT on this list.
    const junkWords = [
        'premium', 'deluxe', 'matured', 'xxx', 'very', 'old', 'vatted',
        'reserve', 'original', 'green label', 'blue label',
        'beer', 'whisky', 'rum', 'gin', 'vodka', 'wine', 'brandy', 'lager', 'pilsner',
        'can', 'bottle', 'pet', 'pint', 'quart'
    ];

    let processedBrand = brand.toLowerCase()
        // Remove content in brackets e.g., [Can], (PET)
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '');

    // Step 1: Expand abbreviations
    const words = processedBrand.split(' ');
    const expandedWords = words.map(word => abbreviations[word.replace(/[^a-z0-9]/gi, '')] || word);
    processedBrand = expandedWords.join(' ');
    
    // Step 2: Remove only the true junk words
    const junkRegex = new RegExp(`\\b(${junkWords.join('|')})\\b`, 'g');
    processedBrand = processedBrand.replace(junkRegex, '');

    // Step 3: Final cleanup
    processedBrand = processedBrand
        .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric chars
        .replace(/\s+/g, '')       // In case any spaces are left
        .trim();

    // Normalize size - extract only numbers
    const sizeFormatted = size.toLowerCase().replace(/[^0-9]/g, '');

    if (!processedBrand || !sizeFormatted) {
        // Fallback for cases where normalization results in an empty string
        return `${brand.replace(/[^a-z0-9]/gi, '').toLowerCase()}_${size.replace(/[^0-9]/gi, '')}`;
    }

    return `${processedBrand}_${sizeFormatted}`;
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


  const addGodownItem = async (newItemData: Omit<GodownItem, 'id' | 'productId' | 'dateAdded'>) => {
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
  
  const addMultipleGodownItems = async (items: ExtractedItem[]): Promise<{ addedCount: number, skippedCount: number }> => {
      if (items.length === 0) return { addedCount: 0, skippedCount: 0 };
      setSaving(true);
      let addedCount = 0;
      let skippedCount = 0;

      try {
        const batch = writeBatch(db);
        const godownRef = collection(db, 'godownInventory');
        
        for (const item of items) {
            // We don't check for existence here anymore to allow multiple batches of the same product
            const productId = generateProductId(item.brand, item.size);
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

  const transferToShop = async (productId: string, quantityToTransfer: number) => {
    setSaving(true);
    const today = format(new Date(), 'yyyy-MM-dd');
    
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

            if (sortedGodownItems.length === 0) {
                 throw new Error(`Product not found in godown.`);
            }

            const totalGodownStock = sortedGodownItems.reduce((sum, doc) => sum + doc.data().quantity, 0);

            if (totalGodownStock < quantityToTransfer) {
                throw new Error(`Not enough stock in godown. Available: ${totalGodownStock}`);
            }
            
            const firstGodownBatch = sortedGodownItems[0].data();
            const shopProductId = generateProductId(firstGodownBatch.brand, firstGodownBatch.size);
            
            const shopItemRef = doc(db, 'inventory', shopProductId);
            const dailyInventoryRef = doc(db, 'dailyInventory', today);

            const shopItemDoc = await transaction.get(shopItemRef);
            
            let shopItemData: any;
            let isNewShopItem = false;

            if (!shopItemDoc.exists()) {
                isNewShopItem = true;
                shopItemData = {
                    brand: firstGodownBatch.brand,
                    size: firstGodownBatch.size,
                    category: firstGodownBatch.category,
                    price: 0,
                    prevStock: 0,
                    transferHistory: [],
                };
            } else {
                shopItemData = shopItemDoc.data();
            }

            let remainingToTransfer = quantityToTransfer;
            const transferTimestamp = Timestamp.now();

            for (const docSnap of sortedGodownItems) {
                if (remainingToTransfer <= 0) break;
                
                const batchData = { id: docSnap.id, ...docSnap.data() } as GodownItem;
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
                 
                transaction.set(shopItemRef, { transferHistory: arrayUnion(newHistoryEntry) }, { merge: true });
                
                remainingToTransfer -= transferAmount;
            }
            
             // Fetch dailyDoc inside transaction only when needed
            const dailyDoc = await transaction.get(dailyInventoryRef);
            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            let currentDailyItem = dailyData[shopProductId];

            if (!currentDailyItem) {
                const prevStock = shopItemData.prevStock ?? 0;
                 currentDailyItem = {
                     brand: shopItemData.brand,
                     size: shopItemData.size,
                     category: shopItemData.category,
                     price: shopItemData.price,
                     prevStock: prevStock,
                     added: 0,
                     sales: 0,
                };
                 if (isNewShopItem) {
                    transaction.set(shopItemRef, shopItemData);
                }
            }
            
            currentDailyItem.added = (currentDailyItem.added || 0) + quantityToTransfer;
            
            transaction.set(dailyInventoryRef, { [shopProductId]: currentDailyItem }, { merge: true });
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
