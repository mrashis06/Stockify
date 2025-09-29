

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
  deleteBrand: (id: string) => Promise<void>;
  deleteUnprocessedItems: (ids: string[]) => Promise<void>;
  transferToShop: (productId: string, quantityToTransfer: number, price?: number) => Promise<void>;
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
  setSaving: (isSaving) => set({ saving: isSaving }),
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
            price: newItemData.price,
            category: newItemData.category,
            stockInGodown: 0,
            barcodeId: null,
            prevStock: newItemData.prevStock
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
                const productSnap = await getDoc(productRef); // Not in transaction, but acceptable for this use case
                if (productSnap.exists()) {
                    const currentStock = productSnap.data().stockInGodown || 0;
                    batch.update(productRef, { stockInGodown: currentStock + item.quantity });
                }
            }
        }

        // Process unmatched items
        if (result.unmatchedItems && result.unmatchedItems.length > 0) {
            result.unmatchedItems.forEach(item => {
                const docRef = doc(collection(db, 'unprocessed_deliveries'));
                batch.set(docRef, { ...item, createdAt: serverTimestamp() });
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
                const newStock = (existingDoc.data().stockInGodown || 0) + details.quantity;
                transaction.update(existingDoc.ref, { stockInGodown: newStock });
            } else {
                const newProductRef = doc(db, 'inventory', barcode);
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
        await updateDoc(docRef, data);
        await get().fetchAllData();
    } catch (error) {
      console.error("Error updating brand: ", error);
      throw error;
    } finally {
        get().setSaving(false);
    }
  },

  deleteBrand: async (id) => {
    get().setSaving(true);
    try {
        const batch = writeBatch(db);
        const masterRef = doc(db, 'inventory', id);
        
        batch.delete(masterRef);
        
        await batch.commit();
        await get().fetchAllData();

    } catch (error) {
        console.error("Error deleting brand:", error);
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
            
            transaction.update(masterRef, { 
              stockInGodown: masterData.stockInGodown - quantityToTransfer,
              ...(price && { price: price }) 
            });

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
            
            const dailyDoc = await transaction.get(dailyDocRef);
            const masterData = masterDoc.data();
            let dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            let itemDailyData = dailyData[id];

            if (!itemDailyData) {
                const yesterdayDoc = await transaction.get(doc(db, 'dailyInventory', yesterday));
                const yesterdayData = yesterdayDoc.exists() ? yesterdayDoc.data() : {};
                const prevStock = yesterdayData[id]?.closing ?? masterData.prevStock ?? 0;
                itemDailyData = { ...masterData, prevStock, added: 0, sales: 0 };
            }

            const openingStock = (itemDailyData.prevStock ?? (masterData.prevStock ?? 0)) + (itemDailyData.added ?? 0);
            if (openingStock < (itemDailyData.sales || 0) + quantity) {
                throw new Error("Insufficient stock to complete sale.");
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
                transaction.update(masterRef, { price: value });
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

            const updateData = { [field]: value };
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

    
