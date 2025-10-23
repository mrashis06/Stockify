
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
import { extractItemsFromBill, BillExtractionOutput } from '@/ai/flows/extract-bill-flow';
import type { ExtractedItem } from '@/ai/flows/extract-bill-flow';
import type { AddGodownItemFormValues } from '@/components/dashboard/add-godown-item-dialog';
import { v4 as uuidv4 } from 'uuid';


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
  addGodownItem: (data: AddGodownItemFormValues) => Promise<void>;
  processScannedBill: (billDataUri: string, fileName: string) => Promise<{ matchedCount: number; unmatchedCount: number; }>;
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

// Simple string similarity function (Jaro-Winkler-like)
const getSimilarity = (s1: string, s2: string): number => {
    let longer = s1.toLowerCase();
    let shorter = s2.toLowerCase();
    if (s1.length < s2.length) {
        longer = s2.toLowerCase();
        shorter = s1.toLowerCase();
    }
    const longerLength = longer.length;
    if (longerLength === 0) {
        return 1.0;
    }
    const matchDistance = Math.floor(longerLength / 2) - 1;
    const shorterMatches = new Array(shorter.length).fill(false);
    const longerMatches = new Array(longer.length).fill(false);
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
        const start = Math.max(0, i - matchDistance);
        const end = Math.min(i + matchDistance + 1, longer.length);
        for (let j = start; j < end; j++) {
            if (longerMatches[j]) continue;
            if (shorter[i] !== longer[j]) continue;
            shorterMatches[i] = true;
            longerMatches[j] = true;
            matches++;
            break;
        }
    }
    if (matches === 0) return 0;
    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < shorter.length; i++) {
        if (!shorterMatches[i]) continue;
        while (!longerMatches[k]) k++;
        if (shorter[i] !== longer[k]) transpositions++;
        k++;
    }
    const jaro = (matches / shorter.length + matches / longer.length + (matches - transpositions / 2) / matches) / 3;
    
    // Jaro-Winkler modification
    let prefix = 0;
    for (let i = 0; i < Math.min(longer.length, 4); i++) {
        if (s1[i] === s2[i]) prefix++;
        else break;
    }
    return jaro + prefix * 0.1 * (1 - jaro);
};


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
        const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
        let masterInventoryState: Map<string, any> = new Map();
        let stableOpeningStock: Map<string, number> = new Map();
        let listeners: (()=>void)[] = [];

        const setupListeners = async () => {
            get()._setLoading(true);

            // Fetch yesterday's closing stock to establish today's stable opening stock.
            const yesterdayDailyRef = doc(db, 'dailyInventory', yesterday);
            const yesterdayDoc = await getDoc(yesterdayDailyRef);
            const yesterdayData = yesterdayDoc.exists() ? yesterdayDoc.data() : {};
            
            const invSnapshot = await getDocs(query(collection(db, "inventory")));
            invSnapshot.forEach(doc => {
                const item = doc.data();
                const opening = yesterdayData[doc.id]?.closing ?? item.prevStock ?? 0;
                stableOpeningStock.set(doc.id, Number(opening));
                masterInventoryState.set(doc.id, { id: doc.id, ...item });
            });


            const invSub = onSnapshot(query(collection(db, "inventory")), (inventorySnapshot) => {
                 inventorySnapshot.docs.forEach(doc => {
                    masterInventoryState.set(doc.id, { id: doc.id, ...doc.data() });
                });
            });
            listeners.push(invSub);

            const dailyDocRef = doc(db, 'dailyInventory', today);
            const dailySub = onSnapshot(dailyDocRef, (dailySnap) => {
                const dailyData = dailySnap.exists() ? dailySnap.data() : {};
                const items: InventoryItem[] = [];
                let onBarTotal = 0;
                const onBarSales: DailyOnBarSale[] = [];

                masterInventoryState.forEach((masterItem, id) => {
                    items.push({
                        ...masterItem,
                        // Use the stable opening stock for prevStock
                        prevStock: stableOpeningStock.get(id) ?? 0,
                        added: Number(dailyData[id]?.added ?? 0),
                        sales: Number(dailyData[id]?.sales ?? 0),
                    });
                });
                
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
                
                set({ 
                    inventory: items.sort((a, b) => a.brand.localeCompare(b.brand)),
                    totalOnBarSales: onBarTotal,
                    dailyOnBarSales: onBarSales,
                    loading: false 
                });
            });
            listeners.push(dailySub);
        
            const unprocessedSub = onSnapshot(query(collection(db, "unprocessed_deliveries"), orderBy('createdAt', 'desc')), (snapshot) => {
                const unprocessed: UnprocessedItem[] = [];
                snapshot.forEach(doc => {
                    unprocessed.push({ id: doc.id, ...doc.data() } as UnprocessedItem);
                });
                set({ 
                    unprocessedItems: unprocessed.sort((a, b) => {
                        const timeA = a.createdAt?.toMillis() || 0;
                        const timeB = b.createdAt?.toMillis() || 0;
                        return timeB - timeA;
                    })
                });
            });
            listeners.push(unprocessedSub);
            
            const onBarSub = onSnapshot(query(collection(db, "onBarInventory"), orderBy('openedAt', 'desc')), (snapshot) => {
                const items: OnBarItem[] = [];
                snapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() } as OnBarItem);
                });
                set({ onBarInventory: items });
            });
            listeners.push(onBarSub);
        }

        setupListeners();
        
        return () => listeners.forEach(unsub => unsub());
    },
    
    forceRefetch: async () => {
        // The new listener model makes forceRefetch less critical for UI updates,
        // but it can be used to re-establish listeners if needed.
        // For simplicity, this can be a no-op if the listeners are robust.
        // Or it can re-trigger init.
        return Promise.resolve();
    },
  
  addBrand: async (newItemData) => {
    get()._setSaving(true);
    try {
        const id = `manual_${uuidv4()}`;
        const docRef = doc(db, 'inventory', id);
        const today = format(new Date(), 'yyyy-MM-dd');
        const dailyRef = doc(db, 'dailyInventory', today);

        const masterItemData = {
            brand: newItemData.brand,
            size: newItemData.size,
            price: Number(newItemData.price),
            category: newItemData.category,
            stockInGodown: 0,
            barcodeId: null,
            prevStock: 0 // Master prev stock should be considered carefully. Let's start it at 0.
        };
        
        const dailyItemData = {
            brand: newItemData.brand,
            size: newItemData.size,
            price: Number(newItemData.price),
            category: newItemData.category,
            prevStock: Number(newItemData.prevStock),
            added: 0,
            sales: 0
        }

        const batch = writeBatch(db);
        batch.set(docRef, masterItemData);
        batch.set(dailyRef, { [id]: dailyItemData }, { merge: true });

        await batch.commit();

    } catch (error) {
        console.error('Error adding brand:', error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
  },

  addGodownItem: async (data: AddGodownItemFormValues) => {
    get()._setSaving(true);
    try {
        await runTransaction(db, async (transaction) => {
            const normalizedBrand = data.brand.trim();
            const normalizedSize = data.size.trim();

            const inventoryRef = collection(db, 'inventory');
            const allInventorySnapshot = await getDocs(inventoryRef);
            
            let bestMatch: { doc: any; score: number } | null = null;
            
            allInventorySnapshot.forEach(doc => {
                const item = doc.data() as InventoryItem;
                if (item.size.toLowerCase() === normalizedSize.toLowerCase()) {
                    const score = getSimilarity(item.brand, normalizedBrand);
                    if (score > (bestMatch?.score || 0.85)) { // Use a threshold of 0.85
                        bestMatch = { doc, score };
                    }
                }
            });

            if (bestMatch) {
                // Matched an existing product, update its godown stock
                const existingDoc = bestMatch.doc;
                const currentStock = existingDoc.data().stockInGodown || 0;
                transaction.update(existingDoc.ref, { 
                    stockInGodown: currentStock + data.quantity,
                    dateAddedToGodown: serverTimestamp(),
                 });
                 toast({ title: 'Stock Updated', description: `Added ${data.quantity} units to existing product: ${existingDoc.data().brand}` });
            } else {
                // No good match found, create a new product
                const newId = `manual_${uuidv4()}`;
                const newProductRef = doc(db, 'inventory', newId);
                transaction.set(newProductRef, {
                    brand: data.brand.trim(),
                    size: data.size.trim(),
                    category: data.category,
                    stockInGodown: data.quantity,
                    price: 0, // Price to be set on first transfer to shop
                    prevStock: 0,
                    barcodeId: null,
                    dateAddedToGodown: serverTimestamp(),
                });
                toast({ title: 'New Product Added', description: `${data.brand} (${data.size}) created.` });
            }
        });
    } catch (e) {
        console.error("Error in addGodownItem transaction:", e);
        throw new Error("Failed to add item to godown.");
    } finally {
        get()._setSaving(false);
    }
},

  processScannedBill: async (billDataUri, fileName) => {
    get()._setSaving(true);
    try {
        const billId = fileName; // Use the filename as the unique ID
        const processedBillRef = doc(db, 'processed_bills', billId);
        const processedBillSnap = await getDoc(processedBillRef);

        if (processedBillSnap.exists()) {
            throw new Error(`Bill with name "${billId}" has already been processed.`);
        }
        
        // Filter inventory to only include items with godown stock > 0
        const inStockInventory = get().inventory.filter(item => (item.stockInGodown || 0) > 0);

        const result: BillExtractionOutput = await extractItemsFromBill({
            billDataUri,
            existingInventory: inStockInventory.map(item => ({
                id: item.id,
                brand: item.brand,
                size: item.size
            })),
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
        
        batch.set(processedBillRef, { processedAt: serverTimestamp(), originalName: billId });

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
            const today = format(new Date(), 'yyyy-MM-dd');
            const dailyRef = doc(db, 'dailyInventory', today);

            const [sourceDoc, destDoc, dailyDoc] = await Promise.all([
                transaction.get(sourceRef),
                transaction.get(destRef),
                transaction.get(dailyRef)
            ]);

            if (!sourceDoc.exists()) throw new Error("Source product to link from not found.");
            if (!destDoc.exists()) throw new Error("Destination product to link to not found.");

            const sourceData = sourceDoc.data() as InventoryItem;
            const destData = destDoc.data() as InventoryItem;
            
            if (!sourceData.barcodeId) throw new Error("Source product does not have a barcode to link.");
            if (destData.barcodeId && destData.barcodeId !== sourceData.barcodeId) {
                throw new Error("Destination product is already mapped to a different barcode.");
            }
            
            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            const sourceDaily = dailyData[sourceProductId] || { added: 0, sales: 0, prevStock: 0 };
            const destDaily = dailyData[destinationProductId] || { added: 0, sales: 0, prevStock: 0 };
            
            const totalStockToMerge = (sourceDaily.prevStock || 0) + (sourceDaily.added || 0);

            // Update destination product
            transaction.update(destRef, {
                barcodeId: destData.barcodeId || sourceData.barcodeId,
                stockInGodown: (destData.stockInGodown || 0) + (sourceData.stockInGodown || 0),
            });
            
            // Update destination daily record
            transaction.set(dailyRef, {
                [destinationProductId]: {
                    ...destDaily,
                    brand: destData.brand,
                    size: destData.size,
                    category: destData.category,
                    price: destData.price,
                    prevStock: (destDaily.prevStock || 0) + totalStockToMerge,
                    sales: (destDaily.sales || 0) + (sourceDaily.sales || 0)
                }
            }, { merge: true });

            // Delete the source product
            transaction.delete(sourceRef);
            
            // Nullify the old daily record entry for the source product
            const dailyUpdate: { [key: string]: any } = {};
            dailyUpdate[sourceProductId] = deleteDoc;
            transaction.update(dailyRef, dailyUpdate);
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
            if (price !== undefined) {
                updateData.price = Number(price);
            }
            transaction.update(masterRef, updateData);

            const itemDailyData = dailyData[productId] || {};
            itemDailyData.added = (itemDailyData.added || 0) + quantityToTransfer;
            
            // Ensure full snapshot is saved
            itemDailyData.brand = masterData.brand;
            itemDailyData.size = masterData.size;
            itemDailyData.category = masterData.category;
            itemDailyData.price = price !== undefined ? Number(price) : masterData.price;
            if (itemDailyData.prevStock === undefined) {
                const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
                const yesterdayDailyRef = doc(db, 'dailyInventory', yesterday);
                const yesterdayDoc = await getDoc(yesterdayDailyRef);
                itemDailyData.prevStock = yesterdayDoc.exists() ? (yesterdayDoc.data()?.[productId]?.closing ?? 0) : 0;
            }
            
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
            const masterRef = doc(db, 'inventory', id);

            // Perform all reads first
            const [dailyDoc, masterDoc] = await Promise.all([
                transaction.get(dailyDocRef),
                transaction.get(masterRef)
            ]);

            if (!masterDoc.exists()) throw new Error("Product not found in master inventory.");

            const masterData = masterDoc.data() as InventoryItem;
            let itemDailyData = (dailyDoc.exists() && dailyDoc.data()?.[id]) ? dailyDoc.data()?.[id] : {};
            
            const liveInventory = get().inventory;
            const liveItem = liveInventory.find(i => i.id === id);
            if (!liveItem) throw new Error("Live product data not found.");

            const openingStock = Number(liveItem.prevStock || 0) + Number(itemDailyData.added || 0);
            const currentSales = Number(itemDailyData.sales || 0);

            if (openingStock < currentSales + quantity) {
                throw new Error(`Insufficient stock. Available: ${openingStock - currentSales}`);
            }

            // Calculations
            itemDailyData.sales = (itemDailyData.sales || 0) + quantity;
            itemDailyData.brand = masterData.brand;
            itemDailyData.size = masterData.size;
            itemDailyData.category = masterData.category;
            itemDailyData.price = salePrice; // Record the price at the time of sale

            // Perform write
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
        await runTransaction(db, async (transaction) => {
            const today = format(new Date(), 'yyyy-MM-dd');
            const masterRef = doc(db, 'inventory', id);
            const dailyRef = doc(db, 'dailyInventory', today);

            const masterDoc = await transaction.get(masterRef);
            if (!masterDoc.exists()) throw new Error("Product not found.");
            
            const dailyDoc = await transaction.get(dailyRef);
            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            const masterData = masterDoc.data() as InventoryItem;
            
            const currentItemDaily = dailyData[id] || {
                added: 0,
                sales: 0,
            };

            // Always ensure the full snapshot is there
            currentItemDaily.brand = masterData.brand;
            currentItemDaily.size = masterData.size;
            currentItemDaily.category = masterData.category;

            if (field === 'price') {
                const newPrice = Number(value);
                currentItemDaily.price = newPrice;
                transaction.update(masterRef, { price: newPrice });
            } else if (field === 'added') {
                const oldValue = Number(currentItemDaily.added) || 0;
                const newValue = Number(value) || 0;
                const difference = newValue - oldValue;

                if (difference < 0) {
                    const stockToReturn = -difference;
                    const newGodownStock = (masterData.stockInGodown || 0) + stockToReturn;
                    transaction.update(masterRef, { stockInGodown: newGodownStock });
                }
                currentItemDaily.added = newValue;
            } else {
                 currentItemDaily[field] = Number(value) || 0;
            }
            
             // Ensure price is set, use master price as fallback if not already in daily log
            if (currentItemDaily.price === undefined) {
                currentItemDaily.price = masterData.price;
            }
            
            transaction.set(dailyRef, { [id]: currentItemDaily }, { merge: true });
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
