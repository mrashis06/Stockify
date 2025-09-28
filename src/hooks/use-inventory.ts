

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
import { createAdminNotification, deleteAdminNotificationByProductId } from './use-notifications';
import { useAuth } from './use-auth';
import { useNotificationSettings } from './use-notification-settings';
import type { ExtractedItem } from '@/ai/flows/extract-bill-flow';

export type InventoryItem = {
  id: string; // This will now often be a barcode
  brand: string;
  size: string;
  price: number;
  category: string;
  stockInGodown: number;
  barcodeId?: string | null;
  // Daily fields - not stored on master doc
  prevStock: number; // Yesterday's closing SHOP stock
  added: number; // Transferred from godown to shop TODAY
  sales: number; // Sold from shop TODAY
  // Calculated fields
  opening?: number; // `prevStock` + `added`
  closing?: number; // `opening` - `sales`
};

export type UnprocessedItem = ExtractedItem & { 
    id: string;
    createdAt: Timestamp;
};


const LOW_STOCK_THRESHOLD = 10;

export function useInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [unprocessedItems, setUnprocessedItems] = useState<UnprocessedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { settings: notificationSettings } = useNotificationSettings();
  
  usePageLoading(loading);

  const today = format(new Date(), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  const fetchAllData = useCallback(async () => {
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
        const yesterdayData = yesterdayDocSnap.exists() ? yesterdaySnap.data() : {};
        
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

        // Unprocessed items are now separate
        const unprocessedSnapshot = await getDocs(query(collection(db, 'unprocessed_deliveries'), orderBy('createdAt', 'desc')));
        const unprocessed: UnprocessedItem[] = [];
        unprocessedSnapshot.forEach(doc => {
            unprocessed.push({ id: doc.id, ...doc.data() } as UnprocessedItem);
        });
        setUnprocessedItems(unprocessed);


      } catch (error) {
        console.error("Error fetching inventory data: ", error);
        toast({ title: 'Error', description: 'Failed to load inventory data.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
  }, [today, yesterday]);

  useEffect(() => {
    // This now fetches everything together.
    fetchAllData();

    const inventoryQuery = query(collection(db, "inventory"));
    const unsubscribeInventory = onSnapshot(inventoryQuery, () => fetchAllData());
      
    const dailyDocRef = doc(db, 'dailyInventory', today);
    const unsubscribeDaily = onSnapshot(dailyDocRef, () => fetchAllData());

    const unprocessedQuery = query(collection(db, "unprocessed_deliveries"));
    const unsubscribeUnprocessed = onSnapshot(unprocessedQuery, () => fetchAllData());

    return () => {
        unsubscribeInventory();
        unsubscribeDaily();
        unsubscribeUnprocessed();
    };
  }, [today, fetchAllData]);
  

  const addBrand = async (newItemData: Omit<InventoryItem, 'id' | 'added' | 'sales' | 'opening' | 'closing' | 'stockInGodown' | 'prevStock'> & {prevStock: number}) => {
    setSaving(true);
    try {
        const id = `manual_${newItemData.brand.toLowerCase().replace(/[^a-z0-9]/g, '')}_${newItemData.size.toLowerCase().replace(/[^0-9]/g, '')}`;
        const docRef = doc(db, 'inventory', id);

        const masterItemData = {
            brand: newItemData.brand,
            size: newItemData.size,
            price: newItemData.price,
            category: newItemData.category,
            stockInGodown: 0,
            barcodeId: null,
        };
        
        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailyItemData = {
            brand: newItemData.brand,
            size: newItemData.size,
            price: newItemData.price,
            category: newItemData.category,
            added: 0,
            sales: 0,
            closing: newItemData.prevStock,
        };

        const batch = writeBatch(db);
        batch.set(docRef, { ...masterItemData, prevStock: newItemData.prevStock });
        batch.set(dailyDocRef, { [id]: dailyItemData }, { merge: true });
        
        await batch.commit();

    } catch (error) {
        console.error('Error adding brand:', error);
        throw error;
    } finally {
        setSaving(false);
    }
  };

  const addItemsFromBillToHolding = async (items: ExtractedItem[]): Promise<number> => {
      if (items.length === 0) return 0;
      setSaving(true);
      try {
          const batch = writeBatch(db);
          items.forEach(item => {
              const docRef = doc(collection(db, 'unprocessed_deliveries'));
              batch.set(docRef, { ...item, createdAt: serverTimestamp() });
          });
          await batch.commit();
          return items.length;
      } catch (e) {
          console.error("Error adding items to holding area:", e);
          throw e;
      } finally {
          setSaving(false);
      }
  }

  const processScannedDelivery = async (
    unprocessedItemId: string, 
    barcode: string, 
    details: { price: number, quantity: number, brand: string, size: string, category: string }
  ) => {
    setSaving(true);
    try {
        await runTransaction(db, async (transaction) => {
            const inventoryQuery = query(collection(db, 'inventory'), where('barcodeId', '==', barcode), limit(1));
            const existingProducts = await getDocs(inventoryQuery);

            let productId: string;
            
            if (!existingProducts.empty) { // Barcode exists
                const existingDoc = existingProducts.docs[0];
                productId = existingDoc.id;
                const newStock = (existingDoc.data().stockInGodown || 0) + details.quantity;
                transaction.update(existingDoc.ref, { stockInGodown: newStock });

            } else { // New barcode, create new product
                productId = barcode; // The barcode is the new ID
                const newProductRef = doc(db, 'inventory', productId);
                const newProductData = {
                    brand: details.brand,
                    size: details.size,
                    category: details.category,
                    price: details.price,
                    stockInGodown: details.quantity,
                    barcodeId: barcode,
                    prevStock: 0,
                };
                transaction.set(newProductRef, newProductData);
            }
            
            // Delete the unprocessed item
            const unprocessedRef = doc(db, 'unprocessed_deliveries', unprocessedItemId);
            transaction.delete(unprocessedRef);
        });

    } catch(e) {
        console.error("Error processing delivery:", e);
        throw e;
    } finally {
        setSaving(false);
    }
  }


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
        const masterRef = doc(db, 'inventory', id);
        const masterSnap = await getDoc(masterRef);
        if (!masterSnap.exists()) {
            setSaving(false);
            return;
        }

        const masterData = masterSnap.data() as InventoryItem;

        if ((masterData.stockInGodown || 0) > 0) {
            throw new Error("Cannot delete. Product still has stock in the godown.");
        }

        const dailyDocRef = doc(db, 'dailyInventory', today);
        const dailySnap = await getDoc(dailyDocRef);
        const dailyData = dailySnap.exists() ? dailySnap.data() : {};
        const dailyItem = dailyData[id];
        
        const prevStock = masterData.prevStock || 0;
        const added = dailyItem?.added || 0;
        const sales = dailyItem?.sales || 0;
        const shopStock = (prevStock + added) - sales;

        if (shopStock > 0) {
            throw new Error("Cannot delete. Product still has stock in the shop.");
        }

        await deleteDoc(masterRef);

    } catch (error) {
        console.error("Error deleting brand:", error);
        throw error;
    } finally {
        setSaving(false);
    }
  };

 const transferToShop = async (productId: string, quantityToTransfer: number, price?: number) => {
    setSaving(true);
    try {
        await runTransaction(db, async (transaction) => {
            const masterRef = doc(db, 'inventory', productId);
            const dailyRef = doc(db, 'dailyInventory', today);

            const masterDoc = await transaction.get(masterRef);
            if (!masterDoc.exists()) {
                throw new Error("Product master record not found.");
            }
            
            const dailyDoc = await transaction.get(dailyRef);
            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            const masterData = masterDoc.data() as InventoryItem;

            const currentGodownStock = masterData.stockInGodown || 0;
            if (currentGodownStock < quantityToTransfer) {
                throw new Error(`Not enough stock in godown. Available: ${currentGodownStock}`);
            }
            const newGodownStock = currentGodownStock - quantityToTransfer;
            
            const masterUpdate: { stockInGodown: number; price?: number } = { stockInGodown: newGodownStock };
            if (price !== undefined && masterData.price !== price) {
                masterUpdate.price = price;
            }
            transaction.update(masterRef, masterUpdate);

            const itemDailyData = dailyData[productId] || {
                brand: masterData.brand,
                size: masterData.size,
                category: masterData.category,
                price: price ?? masterData.price,
                added: 0,
                sales: 0,
            };
            itemDailyData.added = (itemDailyData.added || 0) + quantityToTransfer;
            if (price !== undefined) itemDailyData.price = price;

            transaction.set(dailyRef, { [productId]: itemDailyData }, { merge: true });
        });
    } catch (error) {
        console.error("Error transferring to shop:", error);
        throw error;
    } finally {
        setSaving(false);
    }
 };


  const recordSale = async (id: string, quantity: number, salePrice: number, soldBy: string) => {
      setSaving(true);
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
            if(salePrice !== itemDailyData.price) itemDailyData.price = salePrice;

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
        await runTransaction(db, async (transaction) => {
            const masterRef = doc(db, 'inventory', id);
            const dailyRef = doc(db, 'dailyInventory', today);

            const masterDoc = await transaction.get(masterRef);
            if (!masterDoc.exists()) throw new Error("Product not found.");
            
            const dailyDoc = await transaction.get(dailyRef);
            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            const itemDaily = dailyData[id] || {};
            
            const oldAdded = itemDaily.added || 0;
            const newAdded = field === 'added' ? Number(value) : oldAdded;

            const isReturningStock = field === 'added' && newAdded < oldAdded;

            if (isReturningStock) {
                const returnToGodown = oldAdded - newAdded;
                const newGodownStock = (masterDoc.data()?.stockInGodown || 0) + returnToGodown;
                transaction.update(masterRef, { stockInGodown: newGodownStock });
            }
            
            const shouldDelete = field === 'added' && newAdded === 0 && (masterDoc.data()?.prevStock || 0) === 0 && (itemDaily.sales || 0) === 0 && (masterDoc.data()?.stockInGodown || 0) === 0;

            if (shouldDelete) {
                 transaction.delete(masterRef);
                 delete dailyData[id];
                 transaction.set(dailyRef, dailyData);
            } else {
                 if (field === 'price') {
                    transaction.update(masterRef, { price: value });
                }
                const newDailyItem = {
                    ...itemDaily,
                    brand: masterDoc.data()?.brand,
                    size: masterDoc.data()?.size,
                    category: masterDoc.data()?.category,
                    price: field === 'price' ? value : itemDaily.price ?? masterDoc.data()?.price,
                    [field]: value
                };
                transaction.set(dailyRef, { [id]: newDailyItem }, { merge: true });
            }
        });
    } catch (error) {
        console.error(`Error updating field ${field}:`, error);
        throw error;
    } finally {
        setSaving(false);
    }
 };

  return { 
      inventory, 
      unprocessedItems,
      setInventory, 
      loading, 
      saving, 
      addBrand, 
      deleteBrand, 
      updateBrand, 
      updateItemField, 
      recordSale, 
      addItemsFromBillToHolding,
      processScannedDelivery,
      transferToShop, 
      forceRefetch: fetchAllData 
    };
}

    