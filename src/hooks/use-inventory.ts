

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
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { extractItemsFromBill, BillExtractionOutput } from '@/ai/flows/extract-bill-flow';
import type { ExtractedItem } from '@/ai/flows/extract-bill-flow';

export type OnBarItem = {
  id: string;
  inventoryId: string;
  brand: string;
  size: string;
  category: string;
  totalVolume: number;
  remainingVolume: number;
  totalQuantity?: number;
  salesVolume: number;
  salesValue: number;
  price: number;
  pegPrice30ml?: number;
  pegPrice60ml?: number;
  openedAt: any;
  source: 'godown' | 'manual'; // Track where the bottle came from
};

export type DailyOnBarSale = {
    id: string;
    brand: string;
    size: string;
    category: string;
    salesVolume: number;
    salesValue: number;
}

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
  onBarInventory: OnBarItem[];
  dailyOnBarSales: DailyOnBarSale[];
  totalOnBarSales: number;
  loading: boolean;
  saving: boolean;
  
  // Actions
  initListeners: () => () => void;
  forceRefetch: () => Promise<void>;
  addBrand: (newItemData: Omit<InventoryItem, 'id' | 'sales' | 'opening' | 'closing' | 'stockInGodown' | 'prevStock' | 'added'> & {prevStock: number}) => Promise<void>;
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
  
  // On-Bar Actions
  addOnBarItem: (inventoryItemId: string, volume: number, quantity: number, price: number, pegPrices?: { '30ml': number, '60ml': number }) => Promise<void>;
  sellPeg: (id: string, pegSize: 30 | 60 | 'custom', customVolume?: number, customPrice?: number) => Promise<void>;
  refillPeg: (id: string, amount: number) => Promise<void>;
  removeOnBarItem: (id: string) => Promise<void>;
  endOfDayOnBar: () => Promise<void>;

  // Internal state management
  _setLoading: (isLoading: boolean) => void;
  _setSaving: (isSaving: boolean) => void;
};

let listenersInitialized = false;

const useInventoryStore = create<InventoryState>((set, get) => ({
    inventory: [],
    unprocessedItems: [],
    onBarInventory: [],
    dailyOnBarSales: [],
    totalOnBarSales: 0,
    loading: true,
    saving: false,
    
    _setLoading: (isLoading) => set({ loading: isLoading }),
    _setSaving: (isSaving) => set({ saving: isSaving }),

    initListeners: () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        
        const invSub = onSnapshot(query(collection(db, "inventory")), (snapshot) => {
            const masterInventory = new Map<string, any>();
            snapshot.forEach(doc => {
                masterInventory.set(doc.id, { id: doc.id, ...doc.data() });
            });
            
            const dailyDocRef = doc(db, 'dailyInventory', today);
            getDoc(dailyDocRef).then(dailySnap => {
                const dailyData = dailySnap.exists() ? dailySnap.data() : {};
                const items: InventoryItem[] = [];
                masterInventory.forEach((masterItem) => {
                    items.push({
                        ...masterItem,
                        prevStock: Number(masterItem.prevStock || 0),
                        added: Number(dailyData[masterItem.id]?.added ?? 0),
                        sales: Number(dailyData[masterItem.id]?.sales ?? 0),
                    });
                });
                set({ inventory: items.sort((a, b) => a.brand.localeCompare(b.brand)), loading: false });
            });
        });

        const dailySub = onSnapshot(doc(db, 'dailyInventory', today), (dailySnap) => {
            const dailyData = dailySnap.exists() ? dailySnap.data() : {};
            let onBarTotal = 0;
            const onBarSales: DailyOnBarSale[] = [];

            for (const key in dailyData) {
                if (key.startsWith('on-bar-')) {
                    const saleData = dailyData[key];
                    if(saleData.salesValue > 0) {
                        onBarTotal += saleData.salesValue || 0;
                        onBarSales.push({
                            id: key,
                            brand: saleData.brand,
                            size: saleData.size,
                            category: saleData.category,
                            salesVolume: saleData.salesVolume,
                            salesValue: saleData.salesValue,
                        });
                    }
                }
            }

            set(state => ({
                inventory: state.inventory.map(item => ({
                    ...item,
                    added: Number(dailyData[item.id]?.added ?? 0),
                    sales: Number(dailyData[item.id]?.sales ?? 0),
                })),
                totalOnBarSales: onBarTotal,
                dailyOnBarSales: onBarSales,
            }));
        });
        
        const unprocessedSub = onSnapshot(query(collection(db, "unprocessed_deliveries"), orderBy('createdAt', 'desc')), (snapshot) => {
            const unprocessed: UnprocessedItem[] = [];
            snapshot.forEach(doc => {
                unprocessed.push({ id: doc.id, ...doc.data() } as UnprocessedItem);
            });
            set({ unprocessedItems: unprocessed.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()) });
        });
        
        const onBarSub = onSnapshot(query(collection(db, "onBarInventory"), orderBy('openedAt', 'desc')), (snapshot) => {
            const items: OnBarItem[] = [];
            snapshot.forEach((doc) => {
                items.push({ id: doc.id, ...doc.data() } as OnBarItem);
            });
            set({ onBarInventory: items });
        });

        return () => {
            invSub();
            dailySub();
            unprocessedSub();
            onBarSub();
        };
    },
    
    forceRefetch: async () => {
        // The listeners handle this automatically now. This can be a no-op or trigger a manual re-read if needed.
    },
  
  addBrand: async (newItemData) => {
    get()._setSaving(true);
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
    } catch (error) {
        console.error('Error adding brand:', error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
  },

  processScannedBill: async (billDataUri: string) => {
    get()._setSaving(true);
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

        if (result.matchedItems && result.matchedItems.length > 0) {
            for (const item of result.matchedItems) {
                const productRef = doc(db, 'inventory', item.productId);
                const productSnap = await getDoc(productRef); 
                if (productSnap.exists()) {
                    const currentStock = productSnap.data().stockInGodown || 0;
                    batch.update(productRef, { 
                        stockInGodown: currentStock + item.quantity,
                        dateAddedToGodown: serverTimestamp(),
                    });
                }
            }
        }

        if (result.unmatchedItems && result.unmatchedItems.length > 0) {
            result.unmatchedItems.forEach(item => {
                const docRef = doc(collection(db, 'unprocessed_deliveries'));
                batch.set(docRef, { ...item, quantity: Number(item.quantity), createdAt: serverTimestamp() });
            });
        }
        
        await batch.commit();
        
        return {
            matchedCount: result.matchedItems?.length || 0,
            unmatchedCount: result.unmatchedItems?.length || 0,
        };

    } catch (e) {
        console.error("Error processing scanned bill:", e);
        throw e;
    } finally {
        get()._setSaving(false);
    }
  },

  processScannedDelivery: async (unprocessedItemId, barcode, details) => {
    get()._setSaving(true);
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
    } catch(e) {
        console.error("Error processing delivery:", e);
        throw e;
    } finally {
        get()._setSaving(false);
    }
  },

  updateBrand: async (id, data) => {
    get()._setSaving(true);
    try {
        const docRef = doc(db, 'inventory', id);
        const updateData: Partial<InventoryItem> = { ...data };
        if (data.price) {
          updateData.price = Number(data.price);
        }
        await updateDoc(docRef, updateData);
    } catch (error) {
      console.error("Error updating brand: ", error);
      throw error;
    } finally {
        get()._setSaving(false);
    }
  },
  
  linkBarcodeToProduct: async (sourceProductId, destinationProductId) => {
    get()._setSaving(true);
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
            
            transaction.update(destRef, {
                barcodeId: sourceData.barcodeId,
                stockInGodown: (destData.stockInGodown || 0) + (sourceData.stockInGodown || 0),
            });

            transaction.delete(sourceRef);
        });
    } catch (error) {
        console.error("Error linking barcode: ", error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
  },

  updateGodownStock: async (productId, newStock) => {
    get()._setSaving(true);
    try {
        const docRef = doc(db, 'inventory', productId);
        await updateDoc(docRef, { stockInGodown: newStock });
    } catch (error) {
        console.error("Error updating godown stock: ", error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
  },

  deleteBrand: async (id) => {
    get()._setSaving(true);
    try {
        const batch = writeBatch(db);
        const masterRef = doc(db, 'inventory', id);
        batch.delete(masterRef);
        await batch.commit();
    } catch (error) {
        console.error("Error deleting product:", error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
  },
  
  deleteUnprocessedItems: async (ids: string[]) => {
    if (ids.length === 0) return;
    get()._setSaving(true);
    try {
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(db, 'unprocessed_deliveries', id);
            batch.delete(docRef);
        });
        await batch.commit();
    } catch (error) {
        console.error("Error deleting unprocessed items:", error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
  },

  transferToShop: async (productId, quantityToTransfer, price) => {
    get()._setSaving(true);
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
    } catch (error) {
        console.error("Error transferring to shop:", error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
 },
 
  transferToOnBar: async (productId, quantity, pegPrices) => {
    get()._setSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        const masterRef = doc(db, 'inventory', productId);
        const masterDoc = await transaction.get(masterRef);
        if (!masterDoc.exists()) throw new Error("Product not found.");

        const masterData = masterDoc.data() as InventoryItem;
        if ((masterData.stockInGodown || 0) < quantity) {
          throw new Error(`Not enough stock in godown. Available: ${masterData.stockInGodown || 0}`);
        }

        const onBarQuery = query(collection(db, "onBarInventory"), where("inventoryId", "==", productId), limit(1));
        const onBarSnapshot = await getDocs(onBarQuery);
        
        transaction.update(masterRef, {
          stockInGodown: masterData.stockInGodown - quantity,
          lastTransferred: {
             date: serverTimestamp(),
             quantity: quantity,
             destination: 'onbar',
          }
        });

        const isBeer = masterData.category === 'Beer';
        const volumeMatch = masterData.size.match(/(\d+)/);
        const volumePerUnit = volumeMatch ? parseInt(volumeMatch[0], 10) : 0;
        
        if (!onBarSnapshot.empty) {
            const existingOnBarDoc = onBarSnapshot.docs[0];
            const existingData = existingOnBarDoc.data() as OnBarItem;

            let newRemainingVolume = existingData.remainingVolume;
            let newTotalQuantity = existingData.totalQuantity;

            if (isBeer) {
                newRemainingVolume += quantity;
                newTotalQuantity = (newTotalQuantity || 0) + quantity;
            } else {
                newRemainingVolume += (volumePerUnit * quantity);
                 newTotalQuantity = (newTotalQuantity || 0) + quantity;
            }

            transaction.update(existingOnBarDoc.ref, {
                remainingVolume: newRemainingVolume,
                totalQuantity: newTotalQuantity
            });

        } else {
            const onBarItemPayload: Omit<OnBarItem, 'id' | 'openedAt'> = {
                inventoryId: productId,
                brand: masterData.brand,
                size: masterData.size,
                category: masterData.category,
                totalVolume: volumePerUnit,
                remainingVolume: isBeer ? quantity : (volumePerUnit * quantity),
                price: masterData.price,
                totalQuantity: quantity,
                salesVolume: 0,
                salesValue: 0,
                source: 'godown',
            };

            if (!isBeer && pegPrices) {
                onBarItemPayload.pegPrice30ml = pegPrices['30ml'];
                onBarItemPayload.pegPrice60ml = pegPrices['60ml'];
            }

            const newOnBarDocRef = doc(collection(db, "onBarInventory"));
            transaction.set(newOnBarDocRef, { ...onBarItemPayload, openedAt: serverTimestamp() });
        }
      });

    } catch (error) {
      console.error("Error transferring to on-bar:", error);
      throw error;
    } finally {
      get()._setSaving(false);
    }
  },

  recordSale: async (id, quantity, salePrice, soldBy) => {
      get()._setSaving(true);
      try {
        await runTransaction(db, async (transaction) => {
            const today = format(new Date(), 'yyyy-MM-dd');
            const dailyDocRef = doc(db, 'dailyInventory', today);
            
            const liveInventory = get().inventory;
            const liveItem = liveInventory.find(i => i.id === id);
            if (!liveItem) throw new Error("Live product data not found.");

            const openingStock = Number(liveItem.prevStock || 0) + Number(liveItem.added || 0);
            const currentSales = Number(liveItem.sales || 0);

            if (openingStock < currentSales + quantity) {
                throw new Error(`Insufficient stock. Available: ${openingStock - currentSales}`);
            }

            const dailyDoc = await transaction.get(dailyDocRef);
            let itemDailyData = dailyDoc.exists() ? (dailyDoc.data()[id] || {}) : {};

            itemDailyData.sales = (itemDailyData.sales || 0) + quantity;

            transaction.set(dailyDocRef, { [id]: itemDailyData }, { merge: true });
        });
      } catch (error) {
          console.error(`Error recording sale:`, error);
          throw error;
      } finally {
          get()._setSaving(false);
      }
  },
  
 updateItemField: async (id, field, value) => {
    get()._setSaving(true);
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
            const currentItemDaily = dailyData[id] || {};
            
            const updateData: any = {
                brand: masterData.brand,
                size: masterData.size,
                category: masterData.category,
                price: masterData.price,
                added: currentItemDaily.added || 0,
                sales: currentItemDaily.sales || 0,
            };

            if (field === 'price') {
                updateData[field] = Number(value);
                transaction.update(masterRef, { price: Number(value) });
            } else {
                 updateData[field] = Number(value);
            }
            
            transaction.set(dailyRef, { [id]: updateData }, { merge: true });
        });
    } catch (error) {
        console.error(`Error updating field ${field}:`, error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
 },

  // On-Bar Methods
  addOnBarItem: async (inventoryItemId, volume, quantity, price, pegPrices) => {
    if (get().saving) return;
    get()._setSaving(true);
    try {
        const itemInShopRef = doc(db, "inventory", inventoryItemId);
        const itemInShopDoc = await getDoc(itemInShopRef);
        
        if (!itemInShopDoc.exists()) {
            throw new Error("Item not found in shop inventory.");
        }
        
        const itemInShopData = itemInShopDoc.data() as InventoryItem;
        const newOnBarDocRef = doc(collection(db, "onBarInventory"));
        const isBeer = itemInShopData.category === 'Beer';

        const onBarItemPayload: Omit<OnBarItem, 'id' | 'openedAt'> = {
            inventoryId: inventoryItemId,
            brand: itemInShopData.brand,
            size: itemInShopData.size,
            category: itemInShopData.category,
            totalVolume: volume,
            remainingVolume: isBeer ? quantity : volume,
            price: price, // Use the price passed from the dialog
            totalQuantity: isBeer ? quantity : 1,
            salesVolume: 0,
            salesValue: 0,
            source: 'manual' // Manually opened from shop inventory
        };

        if (!isBeer && pegPrices) {
            onBarItemPayload.pegPrice30ml = pegPrices['30ml'];
            onBarItemPayload.pegPrice60ml = pegPrices['60ml'];
        }

        await setDoc(newOnBarDocRef, { ...onBarItemPayload, openedAt: serverTimestamp() });
        
    } catch (error) {
        console.error("Error opening bottle: ", error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
  },

  sellPeg: async (id, pegSize, customVolume, customPrice) => {
    if (get().saving) return;
    get()._setSaving(true);
    try {
        const itemRef = doc(db, 'onBarInventory', id);
        const today = format(new Date(), 'yyyy-MM-dd');
        const dailyDocRef = doc(db, 'dailyInventory', today);

        await runTransaction(db, async (transaction) => {
            // --- ALL READS FIRST ---
            const itemDoc = await transaction.get(itemRef);
            const dailyDoc = await transaction.get(dailyDocRef);

            if (!itemDoc.exists()) {
                throw new Error("Item not found on bar.");
            }
            
            const itemData = itemDoc.data() as OnBarItem;
            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            
            // --- ALL CALCULATIONS ---
            let volumeToSell: number;
            let priceOfSale: number;

            if (itemData.category === 'Beer') {
                volumeToSell = customVolume || 1;
                priceOfSale = customPrice || (itemData.price * volumeToSell);
                if (itemData.remainingVolume < volumeToSell) {
                    throw new Error(`Not enough bottles to sell. Available: ${itemData.remainingVolume}`);
                }
            } else {
                if (pegSize === 'custom') {
                    if (!customVolume || customPrice === undefined) throw new Error("Custom volume and price are required.");
                    volumeToSell = customVolume;
                    priceOfSale = customPrice;
                } else {
                    volumeToSell = pegSize;
                    const priceKey = `pegPrice${pegSize}ml` as keyof OnBarItem;
                    const pegPrice = itemData[priceKey] as number | undefined;
                    if (pegPrice === undefined) throw new Error(`Price for ${pegSize}ml peg is not set for this item.`);
                    priceOfSale = pegPrice;
                }
                 if (itemData.remainingVolume < volumeToSell) {
                    throw new Error(`Not enough liquor remaining. Available: ${itemData.remainingVolume}ml`);
                }
            }
            
            const newRemainingVolume = itemData.remainingVolume - volumeToSell;
            
            const onBarItemId = `on-bar-${itemData.inventoryId}`;
            const itemDailyLog = dailyData[onBarItemId] || {
                brand: itemData.brand,
                size: itemData.size,
                category: itemData.category,
                totalVolume: itemData.totalVolume,
                salesVolume: 0,
                salesValue: 0
            };
            itemDailyLog.salesVolume = (itemDailyLog.salesVolume || 0) + volumeToSell;
            itemDailyLog.salesValue = (itemDailyLog.salesValue || 0) + priceOfSale;

            // --- ALL WRITES LAST ---
            transaction.update(itemRef, {
                remainingVolume: newRemainingVolume,
            });
            transaction.set(dailyDocRef, { [onBarItemId]: itemDailyLog }, { merge: true });
        });
    } catch(error) {
        console.error("Error selling peg: ", error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
  },

  refillPeg: async (id, amount) => {
    if (get().saving) return;
    get()._setSaving(true);
    try {
        const itemRef = doc(db, 'onBarInventory', id);
        await runTransaction(db, async (transaction) => {
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists()) throw new Error("Item not found on bar.");
            
            const itemData = itemDoc.data() as OnBarItem;
            const isBeer = itemData.category === 'Beer';
            
            const today = format(new Date(), 'yyyy-MM-dd');
            const dailyDocRef = doc(db, 'dailyInventory', today);
            const onBarItemId = `on-bar-${itemData.inventoryId}`;
            const dailyDoc = await transaction.get(dailyDocRef);
            
            if (!dailyDoc.exists() || !dailyDoc.data()?.[onBarItemId]) {
                 throw new Error("No sales recorded for this item today to reverse.");
            }

            const dailyLog = dailyDoc.data()?.[onBarItemId];
            const soldAmount = dailyLog.salesVolume || 0;
            const amountToRefill = isBeer ? 1 : amount;

            if (soldAmount < amountToRefill) throw new Error("Cannot refill more than what was sold today.");

            const newRemainingVolume = itemData.remainingVolume + amountToRefill;
            const totalCapacity = isBeer ? (itemData.totalQuantity || 0) : itemData.totalVolume;
            
            if ((isBeer && newRemainingVolume > totalCapacity) || (!isBeer && newRemainingVolume > itemData.totalVolume)) {
                 throw new Error("Refill amount exceeds original capacity.");
            }
            
            let valueToRefund: number;
            if (isBeer) {
                // For beer, the price is per unit.
                if (itemData.price === undefined) throw new Error("Beer unit price is not set.");
                valueToRefund = itemData.price;
            } else {
                // For liquor, calculate refund based on average price per ml sold today.
                if (soldAmount === 0) throw new Error("Cannot calculate refund value with zero sales volume.");
                valueToRefund = (dailyLog.salesValue / soldAmount) * amountToRefill;
            }

            if (isNaN(valueToRefund)) {
                throw new Error("Could not calculate refund value. The transaction cannot proceed.");
            }
            
            // --- ALL WRITES ---
            transaction.update(itemRef, {
                remainingVolume: newRemainingVolume,
            });
            
            dailyLog.salesVolume -= amountToRefill;
            dailyLog.salesValue -= valueToRefund;
            transaction.set(dailyDocRef, { [onBarItemId]: dailyLog }, { merge: true });
        });
    } catch (error) {
        console.error("Error refilling peg: ", error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
  },

  removeOnBarItem: async (id: string) => {
    if(get().saving) return;
    get()._setSaving(true);
    try {
        await runTransaction(db, async (transaction) => {
            const onBarItemRef = doc(db, "onBarInventory", id);
            const onBarItemDoc = await transaction.get(onBarItemRef);
            if (!onBarItemDoc.exists()) throw new Error("On-bar item not found.");

            const onBarItemData = onBarItemDoc.data() as OnBarItem;
            
            // Only return stock if the item came from godown AND has not been sold from.
            if (onBarItemData.source === 'godown' && onBarItemData.salesVolume === 0) {
                 const masterItemRef = doc(db, "inventory", onBarItemData.inventoryId);
                 const masterItemDoc = await transaction.get(masterItemRef);

                 if(masterItemDoc.exists()) {
                    const masterItemData = masterItemDoc.data();
                    const quantityToReturn = onBarItemData.totalQuantity || 1;
                    const newGodownStock = (masterItemData.stockInGodown || 0) + quantityToReturn;
                    transaction.update(masterItemRef, { stockInGodown: newGodownStock });
                 }
            }
            
            transaction.delete(onBarItemRef);
        });
    } catch (error) {
        console.error("Error removing on-bar item: ", error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
  },

    endOfDayOnBar: async () => {
        get()._setSaving(true);
        try {
            const onBarItems = get().onBarInventory;
            if (onBarItems.length === 0) {
                toast({ title: "No items on bar", description: "There are no open bottles to process." });
                return;
            };

            const batch = writeBatch(db);
            onBarItems.forEach(item => {
                const itemRef = doc(db, 'onBarInventory', item.id);
                if (item.category === 'Beer') {
                    // For beer, 'remainingVolume' is the count. This becomes the new total quantity.
                     batch.update(itemRef, {
                        totalQuantity: item.remainingVolume,
                        salesVolume: 0,
                        salesValue: 0,
                    });
                } else {
                    // For liquor, the 'remainingVolume' becomes the new 'totalVolume'
                    batch.update(itemRef, {
                        totalVolume: item.remainingVolume,
                        salesVolume: 0,
                        salesValue: 0,
                    });
                }
            });
            await batch.commit();

        } catch (error) {
            console.error("Error during On-Bar end of day process: ", error);
            throw error;
        } finally {
            get()._setSaving(false);
        }
    },
}));

// Initialize listeners once
if (typeof window !== 'undefined' && !listenersInitialized) {
    useInventoryStore.getState().initListeners();
    listenersInitialized = true;
}

export const useInventory = useInventoryStore;
