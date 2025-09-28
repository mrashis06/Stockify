

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
        'mc': 'mcdowells',
        'bp': 'blenderspride',
        'oc': 'officerschoice',
        'ac': 'aristocrat',
        'rc': 'royalchallenge',
        'rs': 'royalspecial',
        // Add more abbreviations as needed
    };

    // List of "junk" words to be removed. Important identifiers like "strong", "classic", "black" are NOT on this list.
    const junkWords = [
        'premium', 'deluxe', 'matured', 'xxx', 'very', 'old', 'vatted',
        'reserve', 'special', 'original', 'signature', 'green label', 'blue label',
        'beer', 'whisky', 'rum', 'gin', 'vodka', 'wine', 'brandy', 'lager', 'pilsner',
        'can', 'bottle', 'pet', 'pint', 'quart'
    ];

    let processedBrand = brand.toLowerCase()
        // Remove content in brackets e.g., [Can], (PET)
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '');

    // Create a regex from junk words to match them as whole words
    const junkRegex = new RegExp(`\\b(${junkWords.join('|')})\\b`, 'g');
    processedBrand = processedBrand.replace(junkRegex, '');

    // Handle abbreviations by checking word by word
    const words = processedBrand.split(' ');
    const expandedWords = words.map(word => abbreviations[word] || word);
    processedBrand = expandedWords.join(' ');
    
    // Final cleanup: remove all non-alphanumeric characters and extra spaces
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
        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailySnap = await getDoc(dailyDocRef);
        const dailyData = dailySnap.exists() ? dailySnap.data() : {};
        
        const inventorySnapshot = await getDocs(collection(db, 'inventory'));
        const masterInventory = new Map<string, any>();
        inventorySnapshot.forEach(doc => {
            masterInventory.set(doc.id, { id: doc.id, ...doc.data() });
        });

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

            if (dailyItem) {
                items.push({ ...masterItem, ...dailyItem, prevStock, added, sales });
            } else {
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
        
        const finalInventory = processedInventory.filter(item => {
            return (item.closing ?? 0) > 0 || (item.prevStock ?? 0) > 0 || (item.added ?? 0) > 0 || (item.sales ?? 0) > 0;
        });

        setInventory(finalInventory.sort((a, b) => a.brand.localeCompare(b.brand)));
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

        await setDoc(docRef, masterItemData, { merge: true });
        
        const dailyDocRef = doc(db, 'dailyInventory', today);
        
        const dailyItemData = {
            brand: newItemData.brand,
            size: newItemData.size,
            price: newItemData.price,
            category: newItemData.category,
            prevStock: newItemData.prevStock,
            added: 0,
            sales: 0,
        };

        (dailyItemData as any).opening = dailyItemData.prevStock + dailyItemData.added;
        (dailyItemData as any).closing = (dailyItemData as any).opening - dailyItemData.sales;

        await setDoc(dailyDocRef, { [id]: dailyItemData }, { merge: true });

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
      await runTransaction(db, async (transaction) => {
        const dailyDocRef = doc(db, 'dailyInventory', today);
        const inventoryDocRef = doc(db, 'inventory', id);

        const [dailyDoc, inventoryDoc] = await Promise.all([
            transaction.get(dailyDocRef),
            transaction.get(inventoryDocRef)
        ]);
        
        const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
        const itemToday = dailyData[id];

        if (itemToday && itemToday.sales > 0) {
          throw new Error("Cannot delete a product that has been sold today. Please clear today's sales for this item first.");
        }
        
        if (itemToday && itemToday.added > 0) {
            let amountToReturn = itemToday.added;
            const transferHistory = inventoryDoc.exists() ? (inventoryDoc.data()?.transferHistory || []).sort((a: TransferHistory, b: TransferHistory) => b.date.toMillis() - a.date.toMillis()) : [];

            if (transferHistory.length === 0 && amountToReturn > 0) {
                throw new Error("Cannot auto-return stock to godown: No transfer history found.");
            }

            // We must read the godown batches before we write to them
            const batchRefsToRead = transferHistory.map(t => doc(db, "godownInventory", t.batchId));
            const batchDocs = await Promise.all(batchRefsToRead.map(ref => transaction.get(ref)));

            for (let i = 0; i < transferHistory.length; i++) {
                if (amountToReturn <= 0) break;
                
                const transfer = transferHistory[i];
                const returnable = Math.min(amountToReturn, transfer.quantity);

                const batchDoc = batchDocs[i];

                if (batchDoc?.exists()) {
                    transaction.update(batchDoc.ref, { quantity: batchDoc.data()!.quantity + returnable });
                } else {
                    const invData = inventoryDoc.data();
                    const godownProductId = generateProductId(invData?.brand, invData?.size);
                    const godownItem = {
                        brand: invData?.brand, size: invData?.size, category: invData?.category,
                        quantity: returnable, dateAdded: transfer.date, productId: godownProductId,
                    };
                    transaction.set(batchDoc.ref, godownItem);
                }
                amountToReturn -= returnable;
            }
        }

        transaction.delete(inventoryDocRef);

        if (itemToday) {
            const { [id]: _, ...rest } = dailyData;
            transaction.set(dailyDocRef, rest);
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
                // If no entry for today, create one from master data
                const yesterdayDoc = await getDoc(doc(db, 'dailyInventory', yesterday));
                const prevStock = yesterdayDoc.exists() ? (yesterdayDoc.data()[id]?.closing ?? masterData.prevStock ?? 0) : (masterData.prevStock ?? 0);
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

            // Update daily sales
            itemDailyData.sales = newSales;
            dailyData[id] = itemDailyData;
            
            // Create sales log entry
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

            // If price has changed, update master inventory
            if (masterData.price !== salePrice) {
                transaction.update(masterRef, { price: salePrice });
            }
            
            // Handle low stock notifications
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

            // Perform writes at the end
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
    const originalItemState = inventory.find(item => item.id === id);

    try {
        await runTransaction(db, async (transaction) => {
            const masterRef = doc(db, 'inventory', id);
            const dailyDocRef = doc(db, 'dailyInventory', today);
            
            // READ PHASE
            const [dailyDocSnap, masterSnap] = await Promise.all([
                transaction.get(dailyDocRef),
                transaction.get(masterRef)
            ]);

            if (!masterSnap.exists()) throw new Error("Item does not exist.");
            
            const masterData = masterSnap.data() as InventoryItem;
            let dailyData = dailyDocSnap.exists() ? dailyDocSnap.data() : {};
            let itemDailyData = dailyData[id];

            if (!itemDailyData) {
                // If no daily data, we must read yesterday's data to establish prevStock
                const yesterdayDocSnap = await transaction.get(doc(db, 'dailyInventory', yesterday));
                const yesterdayData = yesterdayDocSnap.exists() ? yesterdayDocSnap.data() : {};
                const prevStock = yesterdayData[id]?.closing ?? masterData.prevStock ?? 0;
                itemDailyData = { ...masterData, prevStock, added: 0, sales: 0 };
            }

            const opening = itemDailyData.prevStock || 0;
            const oldClosingStock = opening + (itemDailyData.added || 0) - (itemDailyData.sales || 0);
            
            const currentAdded = itemDailyData.added || 0;
            const newAdded = field === 'added' ? Number(value) : currentAdded;

            let batchDocs: any[] = [];
            let transferHistory = (masterData.transferHistory || []).sort((a,b) => b.date.toMillis() - a.date.toMillis());

            // If we are returning stock, we must read the godown batches first
            if (field === 'added' && newAdded < currentAdded) {
                let amountToReturn = currentAdded - newAdded;
                if (transferHistory.length === 0 && amountToReturn > 0) {
                    throw new Error("Cannot return stock to godown: No transfer history found for this item.");
                }
                const batchRefsToRead = transferHistory.map(t => doc(db, "godownInventory", t.batchId));
                batchDocs = await Promise.all(batchRefsToRead.map(ref => transaction.get(ref)));
            }

            // --- WRITE PHASE ---

            // Now we can start writing changes
            if (field === 'added' && newAdded < currentAdded) {
                let amountToReturn = currentAdded - newAdded;
                const newTransferHistory = [...transferHistory];

                for (let i = 0; i < transferHistory.length; i++) {
                    const transfer = transferHistory[i];
                    if (amountToReturn <= 0) break;
                    
                    const returnable = Math.min(amountToReturn, transfer.quantity);
                    const batchDoc = batchDocs[i];
                    
                    const historyIndex = newTransferHistory.findIndex(h => h.date.isEqual(transfer.date) && h.batchId === transfer.batchId);
                    
                    if(batchDoc?.exists()){
                        transaction.update(batchDoc.ref, { quantity: batchDoc.data()!.quantity + returnable });
                    } else {
                        // Batch was deleted, so we recreate it
                        const godownProductId = generateProductId(masterData.brand, masterData.size);
                        transaction.set(doc(db, "godownInventory", transfer.batchId), {
                            brand: masterData.brand, size: masterData.size, category: masterData.category,
                            quantity: returnable, dateAdded: transfer.date, productId: godownProductId,
                        });
                    }
                     
                    if (historyIndex > -1) {
                         if (newTransferHistory[historyIndex].quantity - returnable > 0) {
                            newTransferHistory[historyIndex].quantity -= returnable;
                        } else {
                            newTransferHistory.splice(historyIndex, 1);
                        }
                    }
                    amountToReturn -= returnable;
                }
                transaction.update(masterRef, { transferHistory: newTransferHistory });
            }
            
            itemDailyData[field] = value;

            if (field === 'price') {
                transaction.update(masterRef, { price: value });
            }

            itemDailyData.opening = opening + (itemDailyData.added || 0);
            itemDailyData.closing = itemDailyData.opening - (itemDailyData.sales || 0);

            const newClosingStock = itemDailyData.closing;

            if (notificationSettings.lowStockAlerts && user?.shopId) {
                 if (newClosingStock <= LOW_STOCK_THRESHOLD && oldClosingStock > LOW_STOCK_THRESHOLD) {
                    // Cannot do another read (getDocs) here for checking existing notifications
                    // We will just create a new one, duplicates can be handled or ignored
                    const notifId = doc(collection(db, 'shops', user.shopId, 'notifications')).id;
                    transaction.set(doc(db, 'shops', user.shopId, 'notifications', notifId), {
                        title: 'Low Stock Alert',
                        description: `${masterData.brand} (${masterData.size}) is running low. Only ${newClosingStock} units left.`,
                        type: 'low-stock',
                        link: '/dashboard/inventory',
                        productId: id,
                        target: 'admin',
                        readBy: [],
                        createdAt: serverTimestamp(),
                    });
                 } else if (newClosingStock > LOW_STOCK_THRESHOLD && oldClosingStock <= LOW_STOCK_THRESHOLD) {
                    // Cannot query inside transaction, so we cannot delete notification here.
                    // This part needs to be handled outside a transaction or by a backend function.
                 }
            }

            dailyData[id] = itemDailyData;
            transaction.set(dailyDocRef, dailyData, { merge: true });
        });

    } catch (error) {
        console.error(`Error updating ${field}:`, error);
        if (originalItemState) {
          setInventory(prev => prev.map(item => item.id === id ? originalItemState : item));
        }
        throw new Error((error as Error).message || `Failed to update ${field}. Please try again.`);
    } finally {
        setSaving(false);
    }
};

  return { inventory, setInventory, loading, saving, addBrand, deleteBrand, updateBrand, updateItemField, recordSale, forceRefetch: fetchInventoryData };
}
