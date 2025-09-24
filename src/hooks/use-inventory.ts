
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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, subDays } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { usePageLoading } from './use-loading';

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
        const dailyDocSnap = await getDoc(dailyDocRef);
        const dailyData = dailyDocSnap.exists() ? dailyDocSnap.data() : {};

        const currentDailyItem = dailyData[id] || {};
        
        const dailyItemData = {
            brand: newItemData.brand,
            size: newItemData.size,
            price: newItemData.price,
            category: newItemData.category,
            prevStock: newItemData.prevStock,
            added: currentDailyItem.added || 0,
            sales: currentDailyItem.sales || 0,
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
            const dailyDocSnap = await transaction.get(dailyDocRef);
            let dailyData = dailyDocSnap.exists() ? dailyDocSnap.data() : {};
            
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

            const currentAdded = dailyData[id].added || 0;
            const newAdded = field === 'added' ? (value as number) : currentAdded;
            const diff = newAdded - currentAdded;

            if (field === 'added' && diff !== 0) {
                if (diff > 0) {
                    const godownItemsQuery = query(
                        collection(db, 'godownInventory'),
                        where('productId', '==', id)
                    );
                    const godownItemsSnapshot = await getDocs(godownItemsQuery);
                    const godownBatches = godownItemsSnapshot.docs
                      .map(d => ({ id: d.id, ...d.data() }))
                      .sort((a, b) => a.dateAdded.toMillis() - b.dateAdded.toMillis());

                    const totalGodownStock = godownBatches.reduce((sum, batch) => sum + batch.quantity, 0);

                    if (totalGodownStock < diff) {
                        throw new Error(`Not enough stock in godown. Available: ${totalGodownStock}`);
                    }
                    
                    let remainingToTransfer = diff;
                    for (const batch of godownBatches) {
                        if (remainingToTransfer <= 0) break;

                        const batchRef = doc(db, 'godownInventory', batch.id);
                        const transferAmount = Math.min(batch.quantity, remainingToTransfer);
                        
                        if (batch.quantity - transferAmount <= 0) {
                            transaction.delete(batchRef);
                        } else {
                            transaction.update(batchRef, { 
                                quantity: batch.quantity - transferAmount,
                                dateTransferred: serverTimestamp() 
                            });
                        }
                        remainingToTransfer -= transferAmount;
                    }
                } else {
                    const masterRef = doc(db, 'inventory', id);
                    const masterSnap = await transaction.get(masterRef);
                    if (!masterSnap.exists()) throw new Error("Cannot return to godown: master item not found.");
                    const masterData = masterSnap.data();
                    
                    const newGodownBatchRef = doc(collection(db, 'godownInventory'));
                    transaction.set(newGodownBatchRef, {
                        brand: masterData.brand,
                        size: masterData.size,
                        category: masterData.category,
                        productId: id,
                        quantity: -diff,
                        dateAdded: serverTimestamp(),
                    });
                }
            }
            
            dailyData[id][field] = value;

             if (field === 'price') {
                const masterRef = doc(db, 'inventory', id);
                transaction.update(masterRef, { price: value });
            }

            dailyData[id].opening = (dailyData[id].prevStock || 0) + (dailyData[id].added || 0);
            dailyData[id].closing = dailyData[id].opening - (dailyData[id].sales || 0);

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

  const openBottleForOnBar = async (inventoryItemId: string, volume: number, quantity: number = 1) => {
    setSaving(true);
    try {
        await runTransaction(db, async (transaction) => {
            const dailyDocRef = doc(db, 'dailyInventory', today);
            const dailyDocSnap = await transaction.get(dailyDocRef);
            let dailyData = dailyDocSnap.exists() ? dailyDocSnap.data() : {};

            if (!dailyData[inventoryItemId]) {
                 const masterRef = doc(db, 'inventory', inventoryItemId);
                const masterSnap = await transaction.get(masterRef);
                if (!masterSnap.exists()) throw new Error("Item does not exist.");

                const yesterdayDocRef = doc(db, 'dailyInventory', yesterday);
                const yesterdaySnap = await transaction.get(yesterdayDocRef);
                const yesterdayData = yesterdaySnap.exists() ? yesterdaySnap.data() : {};
                
                const masterData = masterSnap.data();
                const prevStock = yesterdayData[inventoryItemId]?.closing ?? masterData.prevStock ?? 0;

                dailyData[inventoryItemId] = {
                    ...masterData,
                    prevStock: prevStock,
                    added: 0,
                    sales: 0
                };
            }


            const openingStock = (dailyData[inventoryItemId]?.prevStock ?? 0) + (dailyData[inventoryItemId]?.added ?? 0);
            const closingStock = openingStock - (dailyData[inventoryItemId]?.sales ?? 0);
            if (closingStock < quantity) {
                throw new Error(`Not enough stock in inventory to open ${quantity} bottle(s). Available: ${closingStock}`);
            }
            
            dailyData[inventoryItemId].sales = (dailyData[inventoryItemId].sales ?? 0) + quantity;
            dailyData[inventoryItemId].opening = openingStock;
            dailyData[inventoryItemId].closing = openingStock - dailyData[inventoryItemId].sales;

            transaction.set(dailyDocRef, { [inventoryItemId]: dailyData[inventoryItemId] }, { merge: true });

            const masterItemRef = doc(db, 'inventory', inventoryItemId);
            const masterItemSnap = await transaction.get(masterItemRef);
            if (!masterItemSnap.exists()) throw new Error("Master inventory item not found.");
            const masterItem = masterItemSnap.data();

            const onBarCollectionRef = collection(db, "onBarInventory");

            for (let i = 0; i < quantity; i++) {
                const newOnBarDocRef = doc(onBarCollectionRef);
                transaction.set(newOnBarDocRef, {
                    inventoryId: inventoryItemId,
                    brand: masterItem.brand,
                    size: masterItem.size,
                    category: masterItem.category,
                    totalVolume: volume,
                    remainingVolume: volume,
                    salesVolume: 0,
                    salesValue: 0,
                    price: masterItem.price,
                    openedAt: serverTimestamp(),
                });
            }
        });
    } catch (error) {
        console.error("Error opening bottle(s) for OnBar: ", error);
        throw error;
    } finally {
        setSaving(false);
    }
  };


  return { inventory, setInventory, loading, saving, addBrand, deleteBrand, updateBrand, updateItemField, openBottleForOnBar };
}

    

    
