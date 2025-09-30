

"use client";

import { create } from 'zustand';
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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, subDays } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { createAdminNotification, deleteAdminNotificationByProductId } from './use-notifications';
import { useAuth } from './use-auth';
import { useNotificationSettings } from './use-notification-settings';
import type { ExtractedItem, BillExtractionOutput } from '@/ai/flows/extract-bill-flow';
import { extractItemsFromBill } from '@/ai/flows/extract-bill-flow';


export type InventoryItem = {
  id: string;
  brand: string;
  size: string;
  price: number;
  category: string;
  stockInGodown: number;
  barcodeId?: string | null;
  prevStock: number;
  added: number;
  sales: number;
  opening?: number;
  closing?: number;
  dateAddedToGodown?: Timestamp;
  lastTransferred?: {
    date: Timestamp;
    quantity: number;
    destination: 'shop' | 'onbar';
  };
};

export type UnprocessedItem = ExtractedItem & { 
    id: string;
    createdAt: Timestamp;
};

type InventoryState = {
  inventory: InventoryItem[];
  unprocessedItems: UnprocessedItem[];
  loading: boolean;
  saving: boolean;
  fetchAllData: () => Promise<void>;
  addBrand: (newItemData: Omit<InventoryItem, 'id' | 'added' | 'sales' | 'opening' | 'closing' | 'stockInGodown' | 'prevStock'> & {prevStock: number}) => Promise<void>;
  processScannedBill: (billDataUri: string) => Promise<{ matchedCount: number; unmatchedCount: number; }>;
  processScannedDelivery: (unprocessedItemId: string, barcode: string, details: { price: number; quantity: number; brand: string; size: string; category: string }) => Promise<void>;
  updateBrand: (id: string, data: Partial<Omit<InventoryItem, 'id'>>) => Promise<void>;
  linkBarcodeToProduct: (sourceProductId: string, destinationProductId: string) => Promise<void>;
  updateGodownStock: (productId: string, newStock: number) => Promise<void>;
  deleteBrand: (id: string) => Promise<void>;
  deleteUnprocessedItems: (ids: string[]) => Promise<void>;
  transferToShop: (productId: string, quantityToTransfer: number, price?: number) => Promise<void>;
  transferToOnBar: (productId: string, quantity: number, pegPrices?: { '30ml': number; '60ml': number }) => Promise<void>;
  recordSale: (id: string, quantity: number, salePrice: number, soldBy: string) => Promise<void>;
  updateItemField: (id: string, field: 'added' | 'sales' | 'price' | 'size', value: number | string) => Promise<void>;
  forceRefetch: () => Promise<void>;
  setLoading: (isLoading: boolean) => void;
  setSaving: (isSaving: boolean) => void;
};

const LOW_STOCK_THRESHOLD = 10;


export const useInventory = create<InventoryState>((set, get) => ({
  inventory: [],
  unprocessedItems: [],
  loading: true,
  saving: false,
  setLoading: (isLoading) => set({ loading: isLoading }),
  setSaving: (isSaving) => set({ isSaving: isSaving }),
  forceRefetch: async () => {
    await get().fetchAllData();
  },
  
  fetchAllData: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
      set({ loading: true });
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
            items.push({ ...masterItem, prevStock, added, sales });
        });

        const unprocessedSnapshot = await getDocs(query(collection(db, 'unprocessed_deliveries'), orderBy('createdAt', 'desc')));
        const unprocessed: UnprocessedItem[] = [];
        unprocessedSnapshot.forEach(doc => {
            unprocessed.push({ id: doc.id, ...doc.data() } as UnprocessedItem);
        });

        set({
          inventory: items.sort((a, b) => a.brand.localeCompare(b.brand)),
          unprocessedItems: unprocessed
        });

      } catch (error) {
        console.error("Error fetching inventory data: ", error);
        toast({ title: 'Error', description: 'Failed to load inventory data.', variant: 'destructive' });
      } finally {
        set({ loading: false });
      }
  },

  addBrand: async (newItemData) => {
    get().setSaving(true);
    try {
        const id = `manual_${newItemData.brand.toLowerCase().replace(/[^a-z0-9]/g, '')}_${newItemData.size.toLowerCase().replace(/[^0-9]/g, '')}`;
        const docRef = doc(db, 'inventory', id);

        const masterItemData = {
            brand: newItemData.brand,
            size: newItemData.size,
            price: Number(newItemData.price),
            category: newItemData.category,
            stockInGodown: 0,
            barcodeId: null,
            prevStock: Number(newItemData.prevStock)
        };
        
        await setDoc(docRef, masterItemData);
        await get().fetchAllData();

    } catch (error) {
        console.error('Error adding brand:', error);
        throw error;
    } finally {
        get().setSaving(false);
    }
  },

  processScannedBill: async (billDataUri: string) => {
    get().setSaving(true);
    try {
        const currentInventory = get().inventory.map(item => ({
            id: item.id,
            brand: item.brand,
            size: item.size
        }));

        const result: BillExtractionOutput = await extractItemsFromBill({
            billDataUri,
            existingInventory: currentInventory,
        });

        const batch = writeBatch(db);

        // Process matched items
        if (result.matchedItems && result.matchedItems.length > 0) {
            for (const item of result.matchedItems) {
                const productRef = doc(db, 'inventory', item.productId);
                // We don't need to get() here because the batch will fail if the doc doesn't exist,
                // and we trust the AI flow's output. We need to use a transaction for read-modify-write.
                // For simplicity here, we'll assume a direct update is fine and rely on Firestore's atomicity for the batch.
                // A more robust solution would use a transaction for each item.
                 const productSnap = await getDoc(productRef); // Not in transaction, but acceptable for this use case
                if (productSnap.exists()) {
                    const currentStock = productSnap.data().stockInGodown || 0;
                    batch.update(productRef, { 
                        stockInGodown: currentStock + item.quantity,
                        dateAddedToGodown: serverTimestamp(),
                    });
                }
            }
        }

        // Process unmatched items
        if (result.unmatchedItems && result.unmatchedItems.length > 0) {
            result.unmatchedItems.forEach(item => {
                const docRef = doc(collection(db, 'unprocessed_deliveries'));
                batch.set(docRef, { ...item, quantity: Number(item.quantity), createdAt: serverTimestamp() });
            });
        }
        
        await batch.commit();
        await get().fetchAllData();
        
        return {
            matchedCount: result.matchedItems?.length || 0,
            unmatchedCount: result.unmatchedItems?.length || 0,
        };

    } catch (e) {
        console.error("Error processing scanned bill:", e);
        throw e;
    } finally {
        get().setSaving(false);
    }
  },

  processScannedDelivery: async (unprocessedItemId, barcode, details) => {
    get().setSaving(true);
    try {
        await runTransaction(db, async (transaction) => {
            const inventoryQuery = query(collection(db, 'inventory'), where('barcodeId', '==', barcode), limit(1));
            const querySnapshot = await getDocs(inventoryQuery);

            if (!querySnapshot.empty) {
                const existingDoc = querySnapshot.docs[0];
                const newStock = (existingDoc.data().stockInGodown || 0) + Number(details.quantity);
                transaction.update(existingDoc.ref, { 
                    stockInGodown: newStock,
                    dateAddedToGodown: serverTimestamp()
                });
            } else {
                const newProductRef = doc(db, 'inventory', barcode);
                const newProductData = {
                    brand: details.brand,
                    size: details.size,
                    category: details.category,
                    price: Number(details.price),
                    stockInGodown: Number(details.quantity),
                    barcodeId: barcode,
                    prevStock: 0,
                    dateAddedToGodown: serverTimestamp()
                };
                transaction.set(newProductRef, newProductData);
            }
            
            const unprocessedRef = doc(db, 'unprocessed_deliveries', unprocessedItemId);
            transaction.delete(unprocessedRef);
        });
        await get().fetchAllData();
    } catch(e) {
        console.error("Error processing delivery:", e);
        throw e;
    } finally {
        get().setSaving(false);
    }
  },

  updateBrand: async (id, data) => {
    get().setSaving(true);
    try {
        const docRef = doc(db, 'inventory', id);
        const updateData: Partial<InventoryItem> = { ...data };
        if (data.price) {
          updateData.price = Number(data.price);
        }
        await updateDoc(docRef, updateData);
        await get().fetchAllData();
    } catch (error) {
      console.error("Error updating brand: ", error);
      throw error;
    } finally {
        get().setSaving(false);
    }
  },
  
  linkBarcodeToProduct: async (sourceProductId, destinationProductId) => {
    get().setSaving(true);
    try {
        await runTransaction(db, async (transaction) => {
            const sourceRef = doc(db, 'inventory', sourceProductId);
            const destRef = doc(db, 'inventory', destinationProductId);
            
            const sourceDoc = await transaction.get(sourceRef);
            const destDoc = await transaction.get(destRef);

            if (!sourceDoc.exists() || !destDoc.exists()) {
                throw new Error("One or both products not found.");
            }

            const sourceData = sourceDoc.data() as InventoryItem;
            const destData = destDoc.data() as InventoryItem;
            
            if (!sourceData.barcodeId) {
                throw new Error("Source product does not have a barcode to link.");
            }
            if (destData.barcodeId) {
                throw new Error("Destination product already has a barcode mapped.");
            }
            
            // 1. Move barcode and stock
            transaction.update(destRef, {
                barcodeId: sourceData.barcodeId,
                stockInGodown: (destData.stockInGodown || 0) + (sourceData.stockInGodown || 0),
            });

            // 2. Delete the old "messy" product
            transaction.delete(sourceRef);
        });
        await get().fetchAllData();

    } catch (error) {
        console.error("Error linking barcode: ", error);
        throw error;
    } finally {
        get().setSaving(false);
    }
  },

  updateGodownStock: async (productId, newStock) => {
    get().setSaving(true);
    try {
        const docRef = doc(db, 'inventory', productId);
        await updateDoc(docRef, { stockInGodown: newStock });
        await get().fetchAllData();
    } catch (error) {
        console.error("Error updating godown stock: ", error);
        throw error;
    } finally {
        get().setSaving(false);
    }
  },

  deleteBrand: async (id) => {
    get().setSaving(true);
    try {
        // This is a full delete, which should only be triggered from the main inventory page
        const batch = writeBatch(db);
        const masterRef = doc(db, 'inventory', id);
        batch.delete(masterRef);
        await batch.commit();
        await get().fetchAllData();
    } catch (error) {
        console.error("Error deleting product:", error);
        throw error;
    } finally {
        get().setSaving(false);
    }
  },
  
  deleteUnprocessedItems: async (ids: string[]) => {
    if (ids.length === 0) return;
    get().setSaving(true);
    try {
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(db, 'unprocessed_deliveries', id);
            batch.delete(docRef);
        });
        await batch.commit();
        await get().fetchAllData();
    } catch (error) {
        console.error("Error deleting unprocessed items:", error);
        throw error;
    } finally {
        get().setSaving(false);
    }
  },

  transferToShop: async (productId, quantityToTransfer, price) => {
    get().setSaving(true);
    try {
        await runTransaction(db, async (transaction) => {
            const masterRef = doc(db, 'inventory', productId);
            const dailyRef = doc(db, 'dailyInventory', format(new Date(), 'yyyy-MM-dd'));

            const masterDoc = await transaction.get(masterRef);
            if (!masterDoc.exists()) throw new Error("Product not found.");
            
            const dailyDoc = await transaction.get(dailyRef);
            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            const masterData = masterDoc.data() as InventoryItem;

            if ((masterData.stockInGodown || 0) < quantityToTransfer) {
                throw new Error(`Not enough stock in godown. Available: ${masterData.stockInGodown || 0}`);
            }
            
            const updateData: any = {
                 stockInGodown: masterData.stockInGodown - quantityToTransfer,
                 lastTransferred: {
                    date: serverTimestamp(),
                    quantity: quantityToTransfer,
                    destination: 'shop',
                 }
            };
            if (price) {
                updateData.price = Number(price);
            }
            transaction.update(masterRef, updateData);

            const itemDailyData = dailyData[productId] || { added: 0 };
            itemDailyData.added = (itemDailyData.added || 0) + quantityToTransfer;
            
            transaction.set(dailyRef, { [productId]: itemDailyData }, { merge: true });
        });
        await get().fetchAllData();
    } catch (error) {
        console.error("Error transferring to shop:", error);
        throw error;
    } finally {
        get().setSaving(false);
    }
 },
 
  transferToOnBar: async (productId, quantity, pegPrices) => {
    get().setSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        const masterRef = doc(db, 'inventory', productId);
        const masterDoc = await transaction.get(masterRef);
        if (!masterDoc.exists()) throw new Error("Product not found.");

        const masterData = masterDoc.data() as InventoryItem;
        if ((masterData.stockInGodown || 0) < quantity) {
          throw new Error(`Not enough stock in godown. Available: ${masterData.stockInGodown || 0}`);
        }

        // 1. Decrease stock from Godown and log transfer
        transaction.update(masterRef, {
          stockInGodown: masterData.stockInGodown - quantity,
          lastTransferred: {
             date: serverTimestamp(),
             quantity: quantity,
             destination: 'onbar',
          }
        });

        // 2. Add item(s) to On-Bar inventory
        const isBeer = masterData.category === 'Beer';
        const volumeMatch = masterData.size.match(/(\d+)/);
        const volume = volumeMatch ? parseInt(volumeMatch[0], 10) : 0;
        
        const onBarItemPayload: Omit<any, 'id' | 'openedAt'> = {
            inventoryId: productId,
            brand: masterData.brand,
            size: masterData.size,
            category: masterData.category,
            totalVolume: volume,
            remainingVolume: isBeer ? quantity : volume,
            price: masterData.price,
            totalQuantity: isBeer ? quantity : 1,
            salesVolume: 0,
            salesValue: 0,
            openedAt: serverTimestamp(),
        };

        if (!isBeer && pegPrices) {
            onBarItemPayload.pegPrice30ml = pegPrices['30ml'];
            onBarItemPayload.pegPrice60ml = pegPrices['60ml'];
        }

        const onBarDocRef = doc(collection(db, "onBarInventory"));
        transaction.set(onBarDocRef, onBarItemPayload);
      });

      await get().fetchAllData();

    } catch (error) {
      console.error("Error transferring to on-bar:", error);
      throw error;
    } finally {
      get().setSaving(false);
    }
  },

  recordSale: async (id, quantity, salePrice, soldBy) => {
      get().setSaving(true);
      try {
        await runTransaction(db, async (transaction) => {
            const today = format(new Date(), 'yyyy-MM-dd');
            const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
            const dailyDocRef = doc(db, 'dailyInventory', today);
            const masterRef = doc(db, 'inventory', id);
            
            const masterDoc = await transaction.get(masterRef);
            if (!masterDoc.exists()) throw new Error("Product not found.");
            
            // This is the fix for the POS redirect bug. Re-fetch inventory.
            await get().fetchAllData();
            const liveInventory = get().inventory;
            const liveItem = liveInventory.find(i => i.id === id);
            if (!liveItem) throw new Error("Live product data not found.");

            const openingStock = Number(liveItem.prevStock || 0) + Number(liveItem.added || 0);
            const currentSales = Number(liveItem.sales || 0);

            if (openingStock < currentSales + quantity) {
                throw new Error(`Insufficient stock. Available: ${openingStock - currentSales}`);
            }

            const dailyDoc = await transaction.get(dailyDocRef);
            let dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            let itemDailyData = dailyData[id];
             if (!itemDailyData) {
                const masterData = masterDoc.data();
                itemDailyData = { ...masterData, prevStock: openingStock, sales: 0 };
            }

            itemDailyData.sales = (itemDailyData.sales || 0) + quantity;
            dailyData[id] = itemDailyData;

            transaction.set(dailyDocRef, { [id]: { sales: itemDailyData.sales } }, { merge: true });
        });
        await get().fetchAllData();
      } catch (error) {
          console.error(`Error recording sale:`, error);
          throw error;
      } finally {
          get().setSaving(false);
      }
  },
  
 updateItemField: async (id, field, value) => {
    get().setSaving(true);
    try {
        const today = format(new Date(), 'yyyy-MM-dd');
        await runTransaction(db, async (transaction) => {
            const masterRef = doc(db, 'inventory', id);
            const dailyRef = doc(db, 'dailyInventory', today);

            const masterDoc = await transaction.get(masterRef);
            if (!masterDoc.exists()) throw new Error("Product not found.");
            
            const dailyDoc = await transaction.get(dailyRef);
            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            const masterData = masterDoc.data();

            if (field === 'price') {
                transaction.update(masterRef, { price: Number(value) });
            } else if (field === 'added') {
                const currentAdded = dailyData[id]?.added || 0;
                const newAdded = Number(value);
                const difference = currentAdded - newAdded;
                
                if (difference > 0) { // Stock is being returned to godown
                    const currentGodownStock = masterData.stockInGodown || 0;
                    transaction.update(masterRef, { stockInGodown: currentGodownStock + difference });
                } else if (difference < 0) { // Stock is being moved from godown
                    const currentGodownStock = masterData.stockInGodown || 0;
                    if (currentGodownStock < Math.abs(difference)) {
                        throw new Error("Not enough stock in Godown to add.");
                    }
                    transaction.update(masterRef, { stockInGodown: currentGodownStock + difference });
                }
            }

            const updateData = { [field]: Number(value) };
            transaction.set(dailyRef, { [id]: updateData }, { merge: true });
        });
        await get().fetchAllData();
    } catch (error) {
        console.error(`Error updating field ${field}:`, error);
        throw error;
    } finally {
        get().setSaving(false);
    }
 },
}));

// Initialize listeners
let inventoryUnsubscribe: () => void;
let dailyUnsubscribe: () => void;
let unprocessedUnsubscribe: () => void;

function initializeListeners() {
    const today = format(new Date(), 'yyyy-MM-dd');

    if (inventoryUnsubscribe) inventoryUnsubscribe();
    inventoryUnsubscribe = onSnapshot(query(collection(db, "inventory")), () => {
        useInventory.getState().fetchAllData();
    });

    if (dailyUnsubscribe) dailyUnsubscribe();
    dailyUnsubscribe = onSnapshot(doc(db, 'dailyInventory', today), () => {
        useInventory.getState().fetchAllData();
    });
    
    if (unprocessedUnsubscribe) unprocessedUnsubscribe();
    unprocessedUnsubscribe = onSnapshot(query(collection(db, "unprocessed_deliveries")), () => {
        useInventory.getState().fetchAllData();
    });
}

// Ensure listeners are initialized on client side
if (typeof window !== 'undefined') {
    initializeListeners();
}
