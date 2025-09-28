

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
  id: string; // This will now often be a barcode
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

// Simple, predictable ID generator, only used for manual adds without barcode
const generateManualProductId = (brand: string, size: string) => {
    const brandPart = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const sizePart = size.toLowerCase().replace(/[^0-9]/g, '');
    return `manual_${brandPart}_${sizePart}`;
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
            
            const prevStock = (yesterdayData[id]?.closing ?? masterItem.prevStock) ?? 0;
            
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

  useEffect(() => {
    const inventoryQuery = query(collection(db, "inventory"));
    const unsubscribeInventory = onSnapshot(inventoryQuery, () => {
        fetchInventoryData();
    });
      
    const dailyDocRef = doc(db, 'dailyInventory', today);
    const unsubscribeDaily = onSnapshot(dailyDocRef, () => {
        fetchInventoryData();
    });

    fetchInventoryData();

    return () => {
        unsubscribeInventory();
        unsubscribeDaily();
    };
  }, [today, fetchInventoryData]);
  

  const addBrand = async (newItemData: Omit<InventoryItem, 'id' | 'added' | 'sales' | 'opening' | 'closing' | 'transferHistory'>) => {
    setSaving(true);
    try {
        const id = newItemData.barcodeId || generateManualProductId(newItemData.brand, newItemData.size);
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
            added: 0,
            sales: 0,
        };

        const batch = writeBatch(db);
        batch.set(docRef, masterItemData);
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
        const inventoryDocRef = doc(db, 'inventory', id);
        const dailyDocRef = doc(db, 'dailyInventory', today);

        const [inventoryDoc, dailyDoc] = await Promise.all([
            getDoc(inventoryDocRef),
            getDoc(dailyDocRef)
        ]);

        if (!inventoryDoc.exists()) {
            setSaving(false);
            return;
        }

        const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
        const itemToday = dailyData[id];
        const inventoryData = inventoryDoc.data() as InventoryItem;

        if (itemToday && itemToday.sales > 0) {
            throw new Error("Cannot delete a product with sales today. Clear sales first.");
        }
        
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
        
        const uniqueBatchIds = [...new Set(transferHistory.map(t => t.batchId))];
        const godownSnaps = uniqueBatchIds.length > 0
            ? await Promise.all(uniqueBatchIds.map(batchId => getDoc(doc(db, "godownInventory", batchId))))
            : [];
        const godownDocsMap = new Map<string, DocumentSnapshot>();
        godownSnaps.forEach(snap => godownDocsMap.set(snap.id, snap));

        await runTransaction(db, async (transaction) => {
            transaction.delete(inventoryDocRef);

            if (itemToday) {
                const { [id]: _, ...rest } = dailyData;
                transaction.set(dailyDocRef, rest);
            }
            
            if (amountToReturn > 0 && transferHistory.length > 0) {
                const sortedHistory = [...transferHistory].sort((a, b) => b.date.toMillis() - a.date.toMillis());

                for (const transfer of sortedHistory) {
                    if (amountToReturn <= 0) break;
                    
                    const returnable = Math.min(amountToReturn, transfer.quantity);
                    const batchDocSnap = godownDocsMap.get(transfer.batchId);
                    
                    if (batchDocSnap) {
                        if (batchDocSnap.exists()) {
                            transaction.update(batchDocSnap.ref, { quantity: batchDocSnap.data().quantity + returnable });
                        } else {
                            const godownProductId = `manual_${inventoryData.brand.toLowerCase()}_${inventoryData.size.toLowerCase()}`;
                            transaction.set(batchDocSnap.ref, {
                                brand: inventoryData.brand, size: inventoryData.size, category: inventoryData.category,
                                quantity: returnable, dateAdded: transfer.date, productId: godownProductId,
                            });
                        }
                    }
                    amountToReturn -= returnable;
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
            
            const openingStock = (itemDailyData.prevStock ?? (masterData.prevStock ?? 0)) + (itemDailyData.added ?? 0);
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
    
    // --- Phase 1: All Reads, done outside the transaction ---
    const masterRef = doc(db, 'inventory', id);
    const dailyDocRef = doc(db, 'dailyInventory', today);

    const masterSnap = await getDoc(masterRef);
    if (!masterSnap.exists()) {
        setSaving(false);
        throw new Error("Item does not exist.");
    }
    const masterData = masterSnap.data() as InventoryItem;

    const dailySnap = await getDoc(dailyDocRef);
    const dailyData = dailySnap.exists() ? dailySnap.data() : {};
    const itemDailyData = dailyData[id];
    
    const dailyCurrentAdded = itemDailyData?.added || 0;
    const isReturningStock = field === 'added' && Number(value) < dailyCurrentAdded;
    
    const godownDocsMap = new Map<string, DocumentSnapshot>();
    const sortedHistory: TransferHistory[] = [...(masterData.transferHistory || [])].sort((a, b) => b.date.toMillis() - a.date.toMillis());

    if (isReturningStock && sortedHistory.length > 0) {
        const uniqueBatchIds = [...new Set(sortedHistory.map(t => t.batchId))];
        if (uniqueBatchIds.length > 0) {
            const godownSnaps = await Promise.all(uniqueBatchIds.map(batchId => getDoc(doc(db, "godownInventory", batchId))));
            godownSnaps.forEach(snap => godownDocsMap.set(snap.id, snap));
        }
    }

    try {
        await runTransaction(db, async (transaction) => {
            let currentDailyData = { ...dailyData };
            let currentItemDaily = currentDailyData[id];

            if (!currentItemDaily) {
                const prevStock = masterData.prevStock ?? 0;
                currentItemDaily = { ...masterData, prevStock, added: 0, sales: 0 };
            }

            const oldAdded = currentItemDaily.added || 0;
            const newAdded = field === 'added' ? Number(value) : oldAdded;
            
            const opening = (masterData.prevStock ?? 0) + (itemDailyData?.added ?? 0);
            const closing = opening - (itemDailyData?.sales ?? 0);
            
            const shouldDeleteProduct = field === 'added' && newAdded === 0 && (masterData.prevStock ?? 0) === 0 && (currentItemDaily.sales ?? 0) === 0;

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
                            const godownProductId = `manual_${masterData.brand.toLowerCase()}_${masterData.size.toLowerCase()}`;
                            transaction.set(godownSnap.ref, {
                                brand: masterData.brand, size: masterData.size, category: masterData.category,
                                quantity: returnable, dateAdded: transfer.date, productId: godownProductId,
                            });
                        }
                    }

                    const historyIndex = newTransferHistory.findIndex(h => h.batchId === transfer.batchId && h.date.toMillis() === transfer.date.toMillis());
                    if (historyIndex > -1) {
                         newTransferHistory[historyIndex].quantity -= returnable;
                         if (newTransferHistory[historyIndex].quantity <= 0) {
                            newTransferHistory.splice(historyIndex, 1);
                         }
                    }
                    amountToReturn -= returnable;
                }
                if (!shouldDeleteProduct) {
                    transaction.update(masterRef, { transferHistory: newTransferHistory });
                }
            }
            
            if (shouldDeleteProduct) {
                transaction.delete(masterRef);
                const { [id]: _, ...restOfDailyData } = currentDailyData;
                transaction.set(dailyDocRef, restOfDailyData);
            } else {
                currentItemDaily[field] = value;
                if (field === 'price') {
                    transaction.update(masterRef, { price: value });
                }
                currentDailyData[id] = currentItemDaily;
                transaction.set(dailyDocRef, currentDailyData, { merge: true });
            }
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
