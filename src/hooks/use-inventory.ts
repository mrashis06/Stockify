

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
  addDoc,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
  arrayRemove,
  arrayUnion,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, subDays } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { usePageLoading } from './use-loading';
import type { GodownItem, TransferHistory } from './use-godown-inventory';
import { createAdminNotification, deleteAdminNotificationByProductId } from './use-notifications';
import { useAuth } from './use-auth';
import { useNotificationSettings } from './use-notification-settings';

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
  barcodeId?: string | null;
  qrCodeId?: string | null;
  transferHistory?: TransferHistory[];
};

// The new, robust "Smart ID" generation function.
const generateProductId = (brand: string, size: string) => {
    // Dictionary for common abbreviations
    const abbreviations: { [key: string]: string } = {
        'mc': 'mcdowells', 'bp': 'blenderspride', 'oc': 'officerschoice',
        'ac': 'aristocrat', 'rc': 'royalchallenge', 'rs': 'royalspecial', 'sig': 'signature'
    };

    // Refined list of "junk" words to be removed.
    // Words like 'strong', 'classic', 'black' are NOT on this list.
    const junkWords = [
        'premium', 'deluxe', 'matured', 'xxx', 'very', 'old', 'vatted',
        'reserve', 'original', 'grain',
        'whisky', 'rum', 'gin', 'vodka', 'wine', 'brandy', 'lager', 'pilsner',
        'can', 'bottle', 'pet', 'pint', 'quart', 'ml', 'beer'
    ];

    let processedBrand = brand.toLowerCase()
        // Remove content in brackets e.g., [Can], (PET)
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '');

    // Step 1: Expand abbreviations first
    const words = processedBrand.split(' ');
    const expandedWords = words.map(word => {
        const cleanWord = word.replace(/[^a-z0-9]/gi, '');
        return abbreviations[cleanWord] || word;
    });
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


const LOW_STOCK_THRESHOLD = 10;

export function useInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { settings: notificationSettings } = useNotificationSettings();
  
  usePageLoading(loading);

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  const fetchInventoryData = useCallback(async () => {
      setLoading(true);
      try {
        const inventorySnapshot = await getDocs(collection(db, 'inventory'));
        const masterInventory = new Map<string, any>();
        inventorySnapshot.forEach(doc => {
            masterInventory.set(doc.id, { id: doc.id, ...doc.data() });
        });

        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailySnap = await getDoc(dailyDocRef);
        const dailyData = dailySnap.exists() ? dailySnap.data() : {};

        const yesterdayDocRef = doc(db, 'dailyInventory', yesterday);
        const yesterdayDocSnap = await getDoc(yesterdayDocRef);
        const yesterdayData = yesterdayDocSnap.exists() ? yesterdayDocSnap.data() : {};
        
        const items: InventoryItem[] = [];

        masterInventory.forEach((masterItem) => {
            const id = masterItem.id;
            const dailyItem = dailyData[id];
            
            const prevStock = yesterdayData[id]?.closing ?? masterItem.prevStock ?? 0;
            
            const added = dailyItem?.added ?? 0;
            const sales = dailyItem?.sales ?? 0;

            items.push({
                ...masterItem,
                prevStock,
                added,
                sales,
            });
        });

        setInventory(items.sort((a, b) => a.brand.localeCompare(b.brand)));
      } catch (error) {
        console.error("Error fetching inventory data: ", error);
        toast({ title: 'Error', description: 'Failed to load inventory data.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
  }, [today, yesterday]);

  // This effect sets up the listener for the daily inventory data
  useEffect(() => {
    const dailyDocRef = doc(db, 'dailyInventory', today);
    const unsubscribe = onSnapshot(dailyDocRef, (doc) => {
        fetchInventoryData(); // Refetch all data when daily doc changes
    });

    // Initial fetch
    fetchInventoryData();

    return () => unsubscribe();
  }, [today, fetchInventoryData]);
  

  const addBrand = async (newItemData: Omit<InventoryItem, 'id' | 'added' | 'sales' | 'opening' | 'closing' | 'transferHistory'>) => {
    setSaving(true);
    try {
        const id = generateProductId(newItemData.brand, newItemData.size);
        const docRef = doc(db, 'inventory', id);

        const masterItemData = {
            brand: newItemData.brand,
            size: newItemData.size,
            price: newItemData.price,
            category: newItemData.category,
            prevStock: newItemData.prevStock,
            barcodeId: newItemData.barcodeId || null,
            qrCodeId: newItemData.qrCodeId || null,
            transferHistory: [],
        };
        
        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailyItemData = {
            brand: newItemData.brand,
            size: newItemData.size,
            price: newItemData.price,
            category: newItemData.category,
            // When a new item is added, its prevStock for today *is* its initial stock.
            // There is no added/sales yet.
            prevStock: newItemData.prevStock, 
            added: 0,
            sales: 0,
        };

        const batch = writeBatch(db);
        batch.set(docRef, masterItemData, { merge: true });
        batch.set(dailyDocRef, { [id]: dailyItemData }, { merge: true });
        
        await batch.commit();

    } catch (error) {
        console.error('Error adding brand:', error);
        throw error;
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
        // --- PRE-TRANSACTION READS ---
        const inventoryDocRef = doc(db, 'inventory', id);
        const dailyDocRef = doc(db, 'dailyInventory', today);

        const [inventoryDoc, dailyDoc] = await Promise.all([
            getDoc(inventoryDocRef),
            getDoc(dailyDocRef)
        ]);

        if (!inventoryDoc.exists()) {
            setSaving(false);
            return; // Already deleted
        }

        const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
        const itemToday = dailyData[id];
        const inventoryData = inventoryDoc.data() as InventoryItem;

        if (itemToday && itemToday.sales > 0) {
            throw new Error("Cannot delete a product with sales today. Clear sales first.");
        }
        
        // If there's no transfer history and stock was added, just allow deletion.
        if (itemToday && itemToday.added > 0 && (!inventoryData.transferHistory || inventoryData.transferHistory.length === 0)) {
             await runTransaction(db, async (transaction) => {
                 transaction.delete(inventoryDocRef);
                 if (itemToday) {
                    const { [id]: _, ...rest } = dailyData;
                    transaction.set(dailyDocRef, rest);
                 }
             });
             toast({ title: "Success", description: "Product with manually added stock has been deleted." });
             setSaving(false);
             return;
        }

        let amountToReturn = itemToday?.added ?? 0;
        const transferHistory = inventoryData.transferHistory || [];
        const updatesForGodown = new Map<string, { doc: GodownItem; amount: number }>();
        let godownDocsToFetch: string[] = [];

        if (amountToReturn > 0 && transferHistory.length > 0) {
            const sortedHistory = [...transferHistory].sort((a, b) => b.date.toMillis() - a.date.toMillis());

            for (const transfer of sortedHistory) {
                if (amountToReturn <= 0) break;

                const returnable = Math.min(amountToReturn, transfer.quantity);
                updatesForGodown.set(transfer.batchId, {
                    doc: { ...inventoryData, id: transfer.batchId, dateAdded: transfer.date, quantity: 0, productId: generateProductId(inventoryData.brand, inventoryData.size) },
                    amount: (updatesForGodown.get(transfer.batchId)?.amount || 0) + returnable,
                });
                
                godownDocsToFetch.push(transfer.batchId);
                amountToReturn -= returnable;
            }
        }
        
        const godownDocsMap = new Map<string, DocumentSnapshot>();
        if (godownDocsToFetch.length > 0) {
            const godownSnaps = await Promise.all(
                godownDocsToFetch.map(batchId => getDoc(doc(db, "godownInventory", batchId)))
            );
            godownSnaps.forEach(snap => godownDocsMap.set(snap.id, snap));
        }

        // --- TRANSACTION ---
        await runTransaction(db, async (transaction) => {
            transaction.delete(inventoryDocRef);

            if (itemToday) {
                const { [id]: _, ...rest } = dailyData;
                transaction.set(dailyDocRef, rest);
            }
            
            for (const [batchId, updateInfo] of updatesForGodown.entries()) {
                 const batchDocSnap = godownDocsMap.get(batchId);
                 if (batchDocSnap) {
                     if (batchDocSnap.exists()) {
                        transaction.update(batchDocSnap.ref, { quantity: batchDocSnap.data().quantity + updateInfo.amount });
                    } else {
                        const { id: docId, ...dataToSet } = updateInfo.doc;
                        transaction.set(batchDocSnap.ref, { ...dataToSet, quantity: updateInfo.amount });
                    }
                 }
            }
        });

    } catch (error) {
        console.error("Error deleting brand:", error);
        throw error;
    } finally {
        setSaving(false);
    }
};


  const recordSale = async (id: string, quantity: number, salePrice: number, soldBy: string) => {
      setSaving(true);
      const originalItem = inventory.find(item => item.id === id);
      if (!originalItem) throw new Error("Item not found to record sale.");

      try {
        await runTransaction(db, async (transaction) => {
            const dailyDocRef = doc(db, 'dailyInventory', today);
            const masterRef = doc(db, 'inventory', id);
            
            const [dailyDoc, masterDoc] = await Promise.all([
                transaction.get(dailyDocRef),
                transaction.get(masterRef)
            ]);

            if (!masterDoc.exists()) throw new Error("Master product record not found.");
            
            const masterData = masterDoc.data();
            let dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            let itemDailyData = dailyData[id];

            if (!itemDailyData) {
                const yesterdayDocSnap = await getDoc(doc(db, 'dailyInventory', yesterday));
                const yesterdayData = yesterdayDocSnap.exists() ? yesterdayDocSnap.data() : {};
                const prevStock = yesterdayData[id]?.closing ?? masterData.prevStock ?? 0;
                itemDailyData = { ...masterData, prevStock, added: 0, sales: 0 };
            }

            const oldSales = itemDailyData.sales || 0;
            const newSales = oldSales + quantity;
            
            const openingStock = (itemDailyData.prevStock ?? 0) + (itemDailyData.added ?? 0);
            const oldClosingStock = openingStock - oldSales;
            const newClosingStock = openingStock - newSales;

            if (newClosingStock < 0) {
                throw new Error("Insufficient stock to complete sale.");
            }

            itemDailyData.sales = newSales;
            dailyData[id] = itemDailyData;
            
            const salesLogRef = doc(collection(db, 'sales_log'));
            transaction.set(salesLogRef, {
                productId: id,
                barcodeId: masterData.barcodeId || null,
                quantity: quantity,
                price: salePrice,
                total: quantity * salePrice,
                soldBy: soldBy,
                createdAt: serverTimestamp(),
            });

            if (masterData.price !== salePrice) {
                transaction.update(masterRef, { price: salePrice });
            }
            
            if (notificationSettings.lowStockAlerts && user?.shopId) {
                 if (newClosingStock <= LOW_STOCK_THRESHOLD && oldClosingStock > LOW_STOCK_THRESHOLD) {
                    await createAdminNotification(user.shopId, {
                        title: 'Low Stock Alert',
                        description: `${masterData.brand} (${masterData.size}) is running low. Only ${newClosingStock} units left.`,
                        type: 'low-stock',
                        link: '/dashboard/inventory',
                        productId: id
                    });
                 }
            }

            transaction.set(dailyDocRef, dailyData, { merge: true });
        });
      } catch (error) {
          console.error(`Error recording sale:`, error);
          throw error;
      } finally {
          setSaving(false);
      }
  };
  
 const updateItemField = async (id: string, field: 'added' | 'sales' | 'price' | 'size', value: number | string) => {
    setSaving(true);

    try {
        // --- Phase 1: All Reads ---
        const masterRef = doc(db, 'inventory', id);
        const dailyDocRef = doc(db, 'dailyInventory', today);

        const masterSnap = await getDoc(masterRef);
        if (!masterSnap.exists()) throw new Error("Item does not exist.");
        const masterData = masterSnap.data() as InventoryItem;

        const dailySnap = await getDoc(dailyDocRef);
        const dailyData = dailySnap.exists() ? dailySnap.data() : {};
        const itemDailyData = dailyData[id];

        const dailyCurrentAdded = itemDailyData?.added || 0;
        const isReturningStock = field === 'added' && Number(value) < dailyCurrentAdded;

        let godownDocsMap = new Map<string, DocumentSnapshot>();
        let sortedHistory: TransferHistory[] = [];

        if (isReturningStock && masterData.transferHistory && masterData.transferHistory.length > 0) {
            sortedHistory = [...masterData.transferHistory].sort((a,b) => b.date.toMillis() - a.date.toMillis());
            
            const uniqueBatchIds = [...new Set(sortedHistory.map(t => t.batchId))];
            const godownSnaps = await Promise.all(uniqueBatchIds.map(batchId => getDoc(doc(db, "godownInventory", batchId))));
            godownSnaps.forEach(snap => godownDocsMap.set(snap.id, snap));
        }

        // --- Phase 2: Transaction with only Writes ---
        await runTransaction(db, async (transaction) => {
            let currentDailyData = { ...dailyData }; // Work on a copy
            let currentItemDaily = currentDailyData[id];

            if (!currentItemDaily) {
                const prevStock = masterData.prevStock ?? 0;
                currentItemDaily = { ...masterData, prevStock, added: 0, sales: 0 };
            }

            const oldAdded = currentItemDaily.added || 0;
            const newAdded = field === 'added' ? Number(value) : oldAdded;

            if (isReturningStock) {
                let amountToReturn = oldAdded - newAdded;
                let newTransferHistory = [...(masterData.transferHistory || [])];

                for (const transfer of sortedHistory) {
                    if (amountToReturn <= 0) break;
                    
                    const returnable = Math.min(amountToReturn, transfer.quantity);
                    const godownSnap = godownDocsMap.get(transfer.batchId);
                    
                    if (godownSnap) {
                         if (godownSnap.exists()) {
                            transaction.update(godownSnap.ref, { quantity: godownSnap.data().quantity + returnable });
                        } else {
                            const godownProductId = generateProductId(masterData.brand, masterData.size);
                            transaction.set(godownSnap.ref, {
                                brand: masterData.brand, size: masterData.size, category: masterData.category,
                                quantity: returnable, dateAdded: transfer.date, productId: godownProductId,
                            });
                        }
                    }

                    const historyIndex = newTransferHistory.findIndex(h => h.batchId === transfer.batchId && h.date.isEqual(transfer.date));
                    if (historyIndex > -1) {
                         newTransferHistory[historyIndex].quantity -= returnable;
                         if (newTransferHistory[historyIndex].quantity <= 0) {
                            newTransferHistory.splice(historyIndex, 1);
                         }
                    }
                    amountToReturn -= returnable;
                }
                transaction.update(masterRef, { transferHistory: newTransferHistory });
            }

            currentItemDaily[field] = value;
            if (field === 'price') {
                transaction.update(masterRef, { price: value });
            }
            
            currentDailyData[id] = currentItemDaily;
            transaction.set(dailyDocRef, currentDailyData, { merge: true });
        });

    } catch (error) {
        console.error(`Error updating ${field}:`, error);
        throw new Error((error as Error).message || `Failed to update ${field}. Please try again.`);
    } finally {
        setSaving(false);
    }
};

  return { inventory, setInventory, loading, saving, addBrand, deleteBrand, updateBrand, updateItemField, recordSale, forceRefetch: fetchInventoryData };
}
