
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
import { createAdminNotification } from './use-notifications';
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
};

// Generates a Firestore-safe ID from brand and size
const generateProductId = (brand: string, size: string) => {
    const brandFormatted = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sizeFormatted = size.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${brandFormatted}_${sizeFormatted}`;
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
            
            const added = dailyItem?.added ?? 0;
            const sales = dailyItem?.sales ?? 0;

            if (dailyItem) {
                items.push({ ...masterItem, ...dailyItem, prevStock, added, sales });
            } else {
                // This is a new day with no entry yet, or item is not in daily doc
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
        
        // Filter out items that have 0 closing stock, 0 prev stock and 0 added stock
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
    });

    return () => unsubscribe();
  }, [today, yesterday]);
  

  const addBrand = async (newItemData: Omit<InventoryItem, 'id' | 'added' | 'sales' | 'opening' | 'closing'>) => {
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
        };

        await setDoc(docRef, masterItemData, { merge: true });
        
        const dailyDocRef = doc(db, 'dailyInventory', today);
        
        // When adding a new brand, we create a fresh daily record for it.
        // We do not merge with any potentially stale data from a previous day's doc copy.
        const dailyItemData = {
            brand: newItemData.brand,
            size: newItemData.size,
            price: newItemData.price,
            category: newItemData.category,
            prevStock: newItemData.prevStock,
            added: 0, // Should be 0 on creation
            sales: 0, // Should be 0 on creation
        };

        dailyItemData.opening = dailyItemData.prevStock + dailyItemData.added;
        dailyItemData.closing = dailyItemData.opening - dailyItemData.sales;

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
            const masterRef = doc(db, 'inventory', id);
            const yesterdayDocRef = doc(db, 'dailyInventory', yesterday);
            
            const [dailyDocSnap, masterSnap, yesterdaySnap] = await Promise.all([
                transaction.get(dailyDocRef),
                transaction.get(masterRef),
                transaction.get(yesterdayDocRef)
            ]);
            
            let dailyData = dailyDocSnap.exists() ? dailyDocSnap.data() : {};
            const itemInDaily = dailyData[id];
            
            if (!itemInDaily) {
                if (!masterSnap.exists()) throw new Error("Item does not exist.");
                const yesterdayData = yesterdaySnap.exists() ? yesterdaySnap.data() : {};
                const masterData = masterSnap.data();
                const prevStock = yesterdayData[id]?.closing ?? masterData.prevStock ?? 0;

                dailyData[id] = {
                    ...masterData,
                    prevStock: prevStock, added: 0, sales: 0
                };
            }

            const oldClosingStock = (itemInDaily?.prevStock || 0) + (itemInDaily?.added || 0) - (itemInDaily?.sales || 0);
            
            // Handle stock return to godown
            if (field === 'added') {
                const currentAdded = itemInDaily?.added || 0;
                const newAdded = Number(value);
                const diff = newAdded - currentAdded;

                if (diff < 0) { // Returning stock to godown
                    let amountToReturn = Math.abs(diff);

                    const godownQuery = query(
                        collection(db, "godownInventory"),
                        where("productId", "==", id)
                    );
                    
                    const godownDocs = await getDocs(godownQuery);
                    // Sort in-code to avoid index requirement
                    const sortedGodownDocs = godownDocs.docs.sort((a, b) => b.data().dateAdded.toMillis() - a.data().dateAdded.toMillis());
                    
                    for (const docSnap of sortedGodownDocs) {
                        if (amountToReturn <= 0) break;
                        const batch = { id: docSnap.id, ...docSnap.data() } as GodownItem;
                        const batchRef = doc(db, "godownInventory", batch.id);

                        const recentHistory = batch.transferHistory
                            ?.filter(h => h.batchId === batch.id)
                            .sort((a,b) => b.date.toMillis() - a.date.toMillis());

                        if (recentHistory && recentHistory.length > 0) {
                            const lastTransfer = recentHistory[0];
                            const returnable = Math.min(amountToReturn, lastTransfer.quantity);

                            transaction.update(batchRef, {
                                quantity: batch.quantity + returnable,
                                transferHistory: arrayRemove(lastTransfer)
                            });
                            
                            if (lastTransfer.quantity - returnable > 0) {
                                transaction.update(batchRef, {
                                    transferHistory: arrayUnion({ ...lastTransfer, quantity: lastTransfer.quantity - returnable })
                                });
                            }
                            amountToReturn -= returnable;
                        }
                    }
                }
            }

            dailyData[id][field] = value;

            if (field === 'price' && masterSnap.exists()) {
                transaction.update(masterRef, { price: value });
            }

            dailyData[id].opening = (dailyData[id].prevStock || 0) + (dailyData[id].added || 0);
            dailyData[id].closing = dailyData[id].opening - (dailyData[id].sales || 0);

            // Check for low stock alert
            if (field === 'sales') {
                 const newClosingStock = dailyData[id].closing;
                 if (notificationSettings.lowStockAlerts && newClosingStock <= LOW_STOCK_THRESHOLD && oldClosingStock > LOW_STOCK_THRESHOLD) {
                    if(user && user.shopId) {
                         createAdminNotification(user.shopId, {
                            title: 'Low Stock Alert',
                            description: `${dailyData[id].brand} (${dailyData[id].size}) is running low. Only ${newClosingStock} units left.`,
                            type: 'low-stock',
                            link: '/dashboard/inventory'
                        });
                    }
                 }
            }

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

  return { inventory, setInventory, loading, saving, addBrand, deleteBrand, updateBrand, updateItemField };
}
