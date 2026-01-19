
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
  deleteField,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, subDays, isToday } from 'date-fns';
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
  offCounterNeedsEOD: boolean;
  onBarNeedsEOD: boolean;
  selectedDate: Date;
  dateChangeConfirmation: Date | null;
  
  // Actions
  setDate: (date: Date) => void;
  confirmDateChange: () => void;
  cancelDateChange: () => void;
  initListeners: (date: Date) => () => void;
  addBrand: (newItemData: Omit<InventoryItem, 'id' | 'sales' | 'opening' | 'closing' | 'stockInGodown' | 'prevStock' | 'added'> & {initialStock: number}) => Promise<void>;
  addGodownItem: (data: AddGodownItemFormValues) => Promise<void>;
  processScannedBill: (billDataUri: string, fileName: string, force?: boolean) => Promise<{ status: 'success' | 'already_processed'; matchedCount: number; unmatchedCount: number; }>;
  processScannedDelivery: (unprocessedItemId: string, barcode: string, details: { price: number; quantity: number; brand: string; size: string; category: string }) => Promise<void>;
  updateBrand: (id: string, data: Partial<Omit<InventoryItem, 'id'>>) => Promise<void>;
  linkBarcodeToProduct: (sourceProductId: string, destinationProductId: string) => Promise<void>;
  updateGodownStock: (productId: string, newStock: number) => Promise<void>;
  deleteBrand: (id: string) => Promise<void>;
  deleteUnprocessedItems: (ids: string[]) => Promise<void>;
  transferToShop: (productId: string, quantityToTransfer: number, price?: number) => Promise<void>;
  bulkTransferToShop: (items: { productId: string; quantity: number; price?: number }[]) => Promise<void>;
  transferToOnBar: (productId: string, quantity: number, pegPrices?: { '30ml': number; '60ml': number }) => Promise<void>;
  bulkTransferToOnBar: (items: { productId: string; quantity: number; pegPrices?: { '30ml': number; '60ml': number } }[]) => Promise<void>;
  recordSale: (id: string, quantity: number, salePrice: number, soldBy: string) => Promise<void>;
  updateItemField: (id: string, field: 'added' | 'sales' | 'price' | 'size', value: number | string) => Promise<void>;
  
  // On-Bar Actions
  addOnBarItem: (inventoryItemId: string, volume: number, quantity: number, price: number, pegPrices?: { '30ml': number, '60ml': number }) => Promise<void>;
  sellPeg: (id: string, pegSize: 30 | 60 | 'custom', customVolume?: number, customPrice?: number) => Promise<void>;
  refillPeg: (id: string, amount: number) => Promise<void>;
  removeOnBarItem: (id: string) => Promise<void>;
  endOfDayOnBar: () => Promise<void>;

  // EOD State Actions
  resetOffCounterEOD: () => void;
  resetOnBarEOD: () => void;

  // Internal state management
  _setLoading: (isLoading: boolean) => void;
  _setSaving: (isSaving: boolean) => void;
  _setSelectedDate: (date: Date) => void;
};

let listeners: (()=>void)[] = [];

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
    offCounterNeedsEOD: false,
    onBarNeedsEOD: false,
    selectedDate: new Date(),
    dateChangeConfirmation: null,
    
    _setLoading: (isLoading) => set({ loading: isLoading }),
    _setSaving: (isSaving) => set({ saving: isSaving }),
    _setSelectedDate: (date: Date) => set({ selectedDate: date }),

    setDate: async (newDate: Date) => {
        const currentDate = get().selectedDate;
        if (isToday(newDate) || newDate.getTime() === currentDate.getTime()) {
            set({ selectedDate: newDate, dateChangeConfirmation: null });
            return;
        }

        const dateStr = format(newDate, 'yyyy-MM-dd');
        const dailyDocRef = doc(db, 'dailyInventory', dateStr);
        const dailyDoc = await getDoc(dailyDocRef);

        let hasSales = false;
        if (dailyDoc.exists()) {
            const data = dailyDoc.data();
            for (const key in data) {
                if (data[key]?.sales > 0 || data[key]?.salesValue > 0) {
                    hasSales = true;
                    break;
                }
            }
        }
        
        if (hasSales) {
            set({ dateChangeConfirmation: newDate });
        } else {
            set({ selectedDate: newDate, dateChangeConfirmation: null });
        }
    },
    confirmDateChange: () => {
        const newDate = get().dateChangeConfirmation;
        if (newDate) {
            set({ selectedDate: newDate, dateChangeConfirmation: null });
        }
    },
    cancelDateChange: () => {
        set({ dateChangeConfirmation: null });
    },
    resetOffCounterEOD: () => set({ offCounterNeedsEOD: false }),
    resetOnBarEOD: () => set({ onBarNeedsEOD: false }),

    initListeners: (date) => {
        get()._setLoading(true);

        // Clear previous listeners
        listeners.forEach(unsub => unsub());
        listeners = [];

        const dateStr = format(date, 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(date, 1), 'yyyy-MM-dd');

        let masterInv: InventoryItem[] = [];
        let dailyData: any = {};
        let initialOpeningStocks = new Map<string, number>();
        let onBarInv: OnBarItem[] = [];
        let unprocessed: UnprocessedItem[] = [];

        const combineAndSetState = () => {
            if (initialOpeningStocks.size === 0 && masterInv.length > 0) return;

            const items: InventoryItem[] = masterInv.map(masterItem => {
                const openingStock = initialOpeningStocks.get(masterItem.id) ?? 0;
                const added = Number(dailyData[masterItem.id]?.added ?? 0);
                const sales = Number(dailyData[masterItem.id]?.sales ?? 0);
                
                return {
                    ...masterItem,
                    prevStock: openingStock,
                    added,
                    sales,
                    opening: openingStock + added,
                    closing: openingStock + added - sales,
                };
            });

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

            set({
                inventory: items.sort((a, b) => a.brand.localeCompare(b.brand)),
                unprocessedItems: unprocessed.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)),
                onBarInventory: onBarInv.sort((a, b) => (b.openedAt?.toMillis() || 0) - (a.openedAt?.toMillis() || 0)),
                dailyOnBarSales: onBarSales,
                totalOnBarSales: onBarTotal,
                loading: false
            });
        };

        const invSub = onSnapshot(query(collection(db, "inventory")), (snapshot) => {
            masterInv = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
            if (initialOpeningStocks.size > 0) {
                combineAndSetState();
            }
        });

        const dailySub = onSnapshot(doc(db, 'dailyInventory', dateStr), (doc) => {
            dailyData = doc.exists() ? doc.data() : {};
            combineAndSetState();
        });

        const unprocessedSub = onSnapshot(query(collection(db, "unprocessed_deliveries"), orderBy('createdAt', 'desc')), (snapshot) => {
            unprocessed = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UnprocessedItem));
            combineAndSetState();
        });

        const onBarSub = onSnapshot(query(collection(db, "onBarInventory"), orderBy('openedAt', 'desc')), (snapshot) => {
            onBarInv = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnBarItem));
            combineAndSetState();
        });
        
        const fetchInitialData = async () => {
            try {
                const inventorySnapshot = await getDocs(collection(db, 'inventory'));
                masterInv = inventorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));

                const yesterdayDoc = await getDoc(doc(db, 'dailyInventory', yesterdayStr));
                const yesterdayData = yesterdayDoc.exists() ? yesterdayDoc.data() : {};

                const openingStocksMap = new Map<string, number>();
                masterInv.forEach(item => {
                    const opening = yesterdayData[item.id]?.closing ?? item.prevStock ?? 0;
                    openingStocksMap.set(item.id, opening);
                });
                initialOpeningStocks = openingStocksMap;

                combineAndSetState();
            } catch (error) {
                console.error("Error fetching initial stock data:", error);
                set({ loading: false });
            }
        };

        fetchInitialData();
        
        listeners.push(invSub, dailySub, unprocessedSub, onBarSub);

        return () => listeners.forEach(unsub => unsub());
    },
  
  addBrand: async (newItemData) => {
    get()._setSaving(true);
    const forDate = get().selectedDate;
    try {
        await runTransaction(db, async (transaction) => {
            const dateStr = format(forDate, 'yyyy-MM-dd');
            const dailyRef = doc(db, 'dailyInventory', dateStr);
            
            const normalizedBrand = newItemData.brand.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedSize = newItemData.size.toLowerCase().replace(/[^a-z0-9]/g, '');
            const id = `manual_${normalizedBrand}_${normalizedSize}`;
            
            const docRef = doc(db, 'inventory', id);

            const [dailyDoc, masterDoc] = await Promise.all([
                transaction.get(dailyRef),
                transaction.get(docRef)
            ]);
            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};

            if (masterDoc.exists()) {
                const currentDaily = dailyData[id] || { added: 0 };
                currentDaily.added = (currentDaily.added || 0) + (newItemData.initialStock || 0);
                transaction.set(dailyRef, { [id]: currentDaily }, { merge: true });
            } else {
                const masterItemData = {
                    brand: newItemData.brand,
                    size: newItemData.size,
                    price: Number(newItemData.price),
                    category: newItemData.category,
                    stockInGodown: 0,
                    barcodeId: null,
                    prevStock: 0,
                };
                
                const dailyItemData = {
                    brand: newItemData.brand,
                    size: newItemData.size,
                    price: Number(newItemData.price),
                    category: newItemData.category,
                    prevStock: 0,
                    added: newItemData.initialStock || 0,
                    sales: 0
                }

                transaction.set(docRef, masterItemData);
                transaction.set(dailyRef, { [id]: dailyItemData }, { merge: true });
            }
        });
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
                    if (score > (bestMatch?.score || 0.85)) {
                        bestMatch = { doc, score };
                    }
                }
            });

            if (bestMatch) {
                const existingDoc = bestMatch.doc;
                const currentStock = existingDoc.data().stockInGodown || 0;
                transaction.update(existingDoc.ref, { 
                    stockInGodown: currentStock + data.quantity,
                    dateAddedToGodown: serverTimestamp(),
                 });
                 toast({ title: 'Stock Updated', description: `Added ${data.quantity} units to existing product: ${existingDoc.data().brand}` });
            } else {
                const newId = `manual_${uuidv4()}`;
                const newProductRef = doc(db, 'inventory', newId);
                transaction.set(newProductRef, {
                    brand: data.brand.trim(),
                    size: data.size.trim(),
                    category: data.category,
                    stockInGodown: data.quantity,
                    price: 0, 
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

    processScannedBill: async (billDataUri, fileName, force = false) => {
        get()._setSaving(true);
        try {
            const billId = fileName;
            const processedBillRef = doc(db, 'processed_bills', billId);

            if (!force) {
                const processedBillSnap = await getDoc(processedBillRef);
                if (processedBillSnap.exists()) {
                    return { status: 'already_processed', matchedCount: 0, unmatchedCount: 0 };
                }
            }
            
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
                status: 'success',
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
        if (data.stockInGodown !== undefined && data.stockInGodown === 0) {
            updateData.lastTransferred = deleteField() as any;
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
    const forDate = get().selectedDate;
    try {
        await runTransaction(db, async (transaction) => {
            const sourceRef = doc(db, 'inventory', sourceProductId);
            const destRef = doc(db, 'inventory', destinationProductId);
            const dateStr = format(forDate, 'yyyy-MM-dd');
            const dailyRef = doc(db, 'dailyInventory', dateStr);

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
            
            const dailyUpdate: { [key: string]: any } = {};
            dailyUpdate[sourceProductId] = deleteField();
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
    const forDate = get().selectedDate;
    try {
        await runTransaction(db, async (transaction) => {
            const masterRef = doc(db, 'inventory', productId);
            const dailyRef = doc(db, 'dailyInventory', format(forDate, 'yyyy-MM-dd'));

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
            
            itemDailyData.brand = masterData.brand;
            itemDailyData.size = masterData.size;
            itemDailyData.category = masterData.category;
            itemDailyData.price = price !== undefined ? Number(price) : masterData.price;
            if (itemDailyData.prevStock === undefined) {
                const yesterday = format(subDays(forDate, 1), 'yyyy-MM-dd');
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

 bulkTransferToShop: async (itemsToTransfer) => {
    if (itemsToTransfer.length === 0) return;
    get()._setSaving(true);
    const forDate = get().selectedDate;
    try {
        await runTransaction(db, async (transaction) => {
            const dateStr = format(forDate, 'yyyy-MM-dd');
            const yesterdayStr = format(subDays(forDate, 1), 'yyyy-MM-dd');

            const dailyRef = doc(db, 'dailyInventory', dateStr);
            const yesterdayDailyRef = doc(db, 'dailyInventory', yesterdayStr);

            const [dailyDoc, yesterdayDoc] = await Promise.all([
                transaction.get(dailyRef),
                transaction.get(yesterdayDailyRef)
            ]);

            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            const yesterdayData = yesterdayDoc.exists() ? yesterdayDoc.data() : {};
            
            const masterRefs = itemsToTransfer.map(item => doc(db, 'inventory', item.productId));
            const masterDocs = await Promise.all(masterRefs.map(ref => transaction.get(ref)));

            for (let i = 0; i < itemsToTransfer.length; i++) {
                const item = itemsToTransfer[i];
                const masterDoc = masterDocs[i];

                if (!masterDoc.exists()) throw new Error(`Product ${item.productId} not found.`);
                
                const masterData = masterDoc.data() as InventoryItem;

                if ((masterData.stockInGodown || 0) < item.quantity) {
                    throw new Error(`Not enough stock for ${masterData.brand}. Available: ${masterData.stockInGodown || 0}`);
                }
                
                const updateData: any = {
                    stockInGodown: masterData.stockInGodown - item.quantity,
                    lastTransferred: {
                        date: serverTimestamp(),
                        quantity: item.quantity,
                        destination: 'shop',
                    }
                };
                if (item.price !== undefined) {
                    updateData.price = Number(item.price);
                }
                transaction.update(masterDoc.ref, updateData);

                const itemDailyData = dailyData[item.productId] || {};
                itemDailyData.added = (itemDailyData.added || 0) + item.quantity;
                
                itemDailyData.brand = masterData.brand;
                itemDailyData.size = masterData.size;
                itemDailyData.category = masterData.category;
                itemDailyData.price = item.price !== undefined ? Number(item.price) : masterData.price;

                if (itemDailyData.prevStock === undefined) {
                    itemDailyData.prevStock = yesterdayData[item.productId]?.closing ?? masterData.prevStock ?? 0;
                }
                
                dailyData[item.productId] = itemDailyData;
            }
            
            transaction.set(dailyRef, dailyData, { merge: true });
        });
    } catch (error) {
        console.error("Error during bulk transfer to shop:", error);
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

  bulkTransferToOnBar: async (itemsToTransfer) => {
    if (itemsToTransfer.length === 0) return;
    get()._setSaving(true);
    try {
        const onBarSnapshot = await getDocs(collection(db, 'onBarInventory'));
        const onBarMap = new Map<string, {id: string, data: OnBarItem}>();
        onBarSnapshot.forEach(doc => {
            const data = doc.data() as OnBarItem;
            onBarMap.set(data.inventoryId, {id: doc.id, data});
        });

        await runTransaction(db, async (transaction) => {
            const masterRefs = itemsToTransfer.map(item => doc(db, 'inventory', item.productId));
            const masterDocs = await Promise.all(masterRefs.map(ref => transaction.get(ref)));

            for (let i = 0; i < itemsToTransfer.length; i++) {
                const itemToTransfer = itemsToTransfer[i];
                const masterDoc = masterDocs[i];

                if (!masterDoc.exists()) throw new Error(`Product ${itemToTransfer.productId} not found.`);
                
                const masterData = masterDoc.data() as InventoryItem;
                if ((masterData.stockInGodown || 0) < itemToTransfer.quantity) {
                    throw new Error(`Not enough stock for ${masterData.brand}. Available: ${masterData.stockInGodown || 0}`);
                }

                transaction.update(masterDoc.ref, {
                    stockInGodown: masterData.stockInGodown - itemToTransfer.quantity,
                    lastTransferred: {
                        date: serverTimestamp(),
                        quantity: itemToTransfer.quantity,
                        destination: 'onbar',
                    }
                });

                const isBeer = masterData.category === 'Beer';
                const volumeMatch = masterData.size.match(/(\d+)/);
                const volumePerUnit = volumeMatch ? parseInt(volumeMatch[0], 10) : 0;

                const existingOnBar = onBarMap.get(itemToTransfer.productId);

                if (existingOnBar) {
                    const onBarRef = doc(db, 'onBarInventory', existingOnBar.id);
                    const existingData = existingOnBar.data;
                    
                    const newRemainingVolume = existingData.remainingVolume + (isBeer ? itemToTransfer.quantity : (volumePerUnit * itemToTransfer.quantity));
                    const newTotalQuantity = (existingData.totalQuantity || 0) + itemToTransfer.quantity;

                    transaction.update(onBarRef, {
                        remainingVolume: newRemainingVolume,
                        totalQuantity: newTotalQuantity
                    });
                } else {
                    const onBarItemPayload: Omit<OnBarItem, 'id' | 'openedAt'> = {
                        inventoryId: itemToTransfer.productId,
                        brand: masterData.brand,
                        size: masterData.size,
                        category: masterData.category,
                        totalVolume: volumePerUnit,
                        remainingVolume: isBeer ? itemToTransfer.quantity : (volumePerUnit * itemToTransfer.quantity),
                        price: masterData.price,
                        totalQuantity: itemToTransfer.quantity,
                        salesVolume: 0,
                        salesValue: 0,
                        source: 'godown',
                    };

                    if (!isBeer && itemToTransfer.pegPrices) {
                        onBarItemPayload.pegPrice30ml = itemToTransfer.pegPrices['30ml'];
                        onBarItemPayload.pegPrice60ml = itemToTransfer.pegPrices['60ml'];
                    }

                    const newOnBarDocRef = doc(collection(db, "onBarInventory"));
                    transaction.set(newOnBarDocRef, { ...onBarItemPayload, openedAt: serverTimestamp() });
                }
            }
        });
    } catch (error) {
        console.error("Error during bulk transfer to on-bar:", error);
        throw error;
    } finally {
        get()._setSaving(false);
    }
  },

  recordSale: async (id, quantity, salePrice, soldBy) => {
      get()._setSaving(true);
      const forDate = get().selectedDate;
      try {
        await runTransaction(db, async (transaction) => {
            const dateStr = format(forDate, 'yyyy-MM-dd');
            const dailyDocRef = doc(db, 'dailyInventory', dateStr);
            const masterRef = doc(db, 'inventory', id);

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

            itemDailyData.sales = (itemDailyData.sales || 0) + quantity;
            itemDailyData.brand = masterData.brand;
            itemDailyData.size = masterData.size;
            itemDailyData.category = masterData.category;
            itemDailyData.price = salePrice; 

            transaction.set(dailyDocRef, { [id]: itemDailyData }, { merge: true });
        });
        set({ offCounterNeedsEOD: isToday(forDate) });
      } catch (error) {
          console.error(`Error recording sale:`, error);
          throw error;
      } finally {
          get()._setSaving(false);
      }
  },
  
 updateItemField: async (id, field, value) => {
    get()._setSaving(true);
    const forDate = get().selectedDate;
    try {
        await runTransaction(db, async (transaction) => {
            const dateStr = format(forDate, 'yyyy-MM-dd');
            const masterRef = doc(db, 'inventory', id);
            const dailyRef = doc(db, 'dailyInventory', dateStr);

            const masterDoc = await transaction.get(masterRef);
            if (!masterDoc.exists()) throw new Error("Product not found.");
            
            const dailyDoc = await transaction.get(dailyRef);
            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            const masterData = masterDoc.data() as InventoryItem;
            
            const currentItemDaily = dailyData[id] || {
                added: 0,
                sales: 0,
            };

            currentItemDaily.brand = masterData.brand;
            currentItemDaily.size = masterData.size;
            currentItemDaily.category = masterData.category;

            if (field === 'price') {
                const newPrice = Number(value);
                currentItemDaily.price = newPrice;
                if (isToday(forDate)) {
                    transaction.update(masterRef, { price: newPrice });
                }
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
            
            if (currentItemDaily.price === undefined) {
                currentItemDaily.price = masterData.price;
            }
            
            transaction.set(dailyRef, { [id]: currentItemDaily }, { merge: true });
        });
        if ((field === 'sales' || field === 'added') && isToday(forDate)) {
            set({ offCounterNeedsEOD: true });
        }
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
            price: price, 
            totalQuantity: isBeer ? quantity : 1,
            salesVolume: 0,
            salesValue: 0,
            source: 'manual'
        };

        if (!isBeer && pegPrices) {
            onBarItemPayload.pegPrice30ml = pegPrices['30ml'];
            onBarItemPayload.pegPrice60ml = pegPrices['60ml'];
        }

        await setDoc(newOnBarDocRef, { ...onBarItemPayload, openedAt: serverTimestamp() });
        set({ onBarNeedsEOD: true });
        
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
    const forDate = get().selectedDate;
    try {
        const itemRef = doc(db, 'onBarInventory', id);
        const dateStr = format(forDate, 'yyyy-MM-dd');
        const dailyDocRef = doc(db, 'dailyInventory', dateStr);

        await runTransaction(db, async (transaction) => {
            const itemDoc = await transaction.get(itemRef);
            const dailyDoc = await transaction.get(dailyDocRef);

            if (!itemDoc.exists()) {
                throw new Error("Item not found on bar.");
            }
            
            const itemData = itemDoc.data() as OnBarItem;
            const dailyData = dailyDoc.exists() ? dailyDoc.data() : {};
            
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

            transaction.update(itemRef, {
                remainingVolume: newRemainingVolume,
            });
            transaction.set(dailyDocRef, { [onBarItemId]: itemDailyLog }, { merge: true });
        });
        if (isToday(forDate)) set({ onBarNeedsEOD: true });
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
    const forDate = get().selectedDate;
    try {
        const itemRef = doc(db, 'onBarInventory', id);
        await runTransaction(db, async (transaction) => {
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists()) throw new Error("Item not found on bar.");
            
            const itemData = itemDoc.data() as OnBarItem;
            const isBeer = itemData.category === 'Beer';
            
            const dateStr = format(forDate, 'yyyy-MM-dd');
            const dailyDocRef = doc(db, 'dailyInventory', dateStr);
            const onBarItemId = `on-bar-${itemData.inventoryId}`;
            const dailyDoc = await transaction.get(dailyDocRef);
            
            if (!dailyDoc.exists() || !dailyDoc.data()?.[onBarItemId]) {
                 throw new Error("No sales recorded for this item on the selected date to reverse.");
            }

            const dailyLog = dailyDoc.data()?.[onBarItemId];
            const soldAmount = dailyLog.salesVolume || 0;
            const amountToRefill = isBeer ? 1 : amount;

            if (soldAmount < amountToRefill) throw new Error("Cannot refill more than what was sold.");

            const newRemainingVolume = itemData.remainingVolume + amountToRefill;
            const totalCapacity = isBeer ? (itemData.totalQuantity || 0) : itemData.totalVolume;
            
            if ((isBeer && newRemainingVolume > totalCapacity) || (!isBeer && newRemainingVolume > itemData.totalVolume)) {
                 throw new Error("Refill amount exceeds original capacity.");
            }
            
            let valueToRefund: number;
            if (isBeer) {
                if (itemData.price === undefined) throw new Error("Beer unit price is not set.");
                valueToRefund = itemData.price;
            } else {
                if (soldAmount === 0) throw new Error("Cannot calculate refund value with zero sales volume.");
                valueToRefund = (dailyLog.salesValue / soldAmount) * amountToRefill;
            }

            if (isNaN(valueToRefund)) {
                throw new Error("Could not calculate refund value. The transaction cannot proceed.");
            }
            
            transaction.update(itemRef, {
                remainingVolume: newRemainingVolume,
            });
            
            dailyLog.salesVolume -= amountToRefill;
            dailyLog.salesValue -= valueToRefund;
            transaction.set(dailyDocRef, { [onBarItemId]: dailyLog }, { merge: true });
        });
        if (isToday(forDate)) set({ onBarNeedsEOD: true });
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
                     batch.update(itemRef, {
                        totalQuantity: item.remainingVolume,
                        salesVolume: 0,
                        salesValue: 0,
                    });
                } else {
                    batch.update(itemRef, {
                        totalVolume: item.remainingVolume,
                        salesVolume: 0,
                        salesValue: 0,
                    });
                }
            });
            await batch.commit();
            get().resetOnBarEOD();

        } catch (error) {
            console.error("Error during On-Bar end of day process: ", error);
            throw error;
        } finally {
            get()._setSaving(false);
        }
    },
}));

export const useInventory = useInventoryStore;
