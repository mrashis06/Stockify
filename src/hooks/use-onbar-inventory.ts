
"use client";

import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  writeBatch,
  runTransaction,
  deleteDoc,
  serverTimestamp,
  addDoc,
  getDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useInventory } from './use-inventory'; // To trigger stock updates
import { usePageLoading } from './use-loading';

export type OnBarItem = {
  id: string;
  inventoryId: string; // The ID from the main inventory collection, 'manual' if not tracked
  brand: string;
  size: string;
  category: string;
  totalVolume: number; // e.g., 750 for a 750ml bottle, or the volume of one beer bottle
  remainingVolume: number; // remaining ml for liquor, or remaining *units* for beer
  totalQuantity?: number; // Total units for grouped items like beer
  salesVolume: number; // Volume sold today in ml (for liquor) or units (for beer)
  salesValue: number; // Monetary value of sales today
  price: number; // Price of the full bottle (for liquor) or a single unit (for beer)
  pegPrice30ml?: number;
  pegPrice60ml?: number;
  openedAt: any; // Firestore Timestamp
};

export type OnBarManualItem = Omit<OnBarItem, 'id' | 'inventoryId' | 'remainingVolume' | 'salesVolume' | 'salesValue' | 'openedAt'> & { quantity: number };

export function useOnBarInventory() {
  const [onBarInventory, setOnBarInventory] = useState<OnBarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { inventory, updateItemField, forceRefetch } = useInventory();

  usePageLoading(loading);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, "onBarInventory"), (snapshot) => {
      const items: OnBarItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as OnBarItem);
      });
      setOnBarInventory(items.sort((a,b) => a.brand.localeCompare(b.brand)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const addOnBarItem = async (inventoryItemId: string, volume: number, quantity: number = 1, pegPrices?: { '30ml': number; '60ml': number }) => {
      if (saving) return;
      setSaving(true);
      try {
        const itemInShop = inventory.find(item => item.id === inventoryItemId);
        if (!itemInShop) throw new Error("Item not found in shop inventory.");
        
        const newOnBarDocRef = doc(collection(db, "onBarInventory"));
        
        const isBeer = itemInShop.category === 'Beer';

        const onBarItemPayload: Omit<OnBarItem, 'id' | 'openedAt'> = {
            inventoryId: inventoryItemId,
            brand: itemInShop.brand,
            size: itemInShop.size,
            category: itemInShop.category,
            totalVolume: volume,
            remainingVolume: isBeer ? quantity : volume,
            price: itemInShop.price,
            totalQuantity: isBeer ? quantity : 1,
            salesVolume: 0,
            salesValue: 0,
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
          setSaving(false);
      }
  };

  const sellPeg = async (id: string, pegSize: 30 | 60 | 'custom', customVolume?: number, customPrice?: number) => {
    if (saving) return;
    setSaving(true);

    try {
        const itemRef = doc(db, 'onBarInventory', id);
        await runTransaction(db, async (transaction) => {
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists()) throw new Error("Item not found on bar.");
            
            const itemData = itemDoc.data() as OnBarItem;
            
            let volumeToSell: number;
            let priceOfSale: number;

            if (itemData.category === 'Beer') {
                volumeToSell = customVolume || 1; // For beer, volume is quantity
                priceOfSale = customPrice || (itemData.price * volumeToSell);
                if (itemData.remainingVolume < volumeToSell) {
                    throw new Error(`Not enough bottles to sell. Available: ${itemData.remainingVolume}`);
                }
            } else { // Liquor
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
            const newSalesVolume = (itemData.salesVolume || 0) + volumeToSell;
            const newSalesValue = (itemData.salesValue || 0) + priceOfSale;

            transaction.update(itemRef, {
                remainingVolume: newRemainingVolume,
                salesVolume: newSalesVolume,
                salesValue: newSalesValue,
            });
        });
    } catch(error) {
        console.error("Error selling peg: ", error);
        throw error;
    } finally {
        setSaving(false);
    }
  }


  const refillPeg = async (id: string, amount: number) => {
    if (saving) return;
    setSaving(true);
    try {
        const itemRef = doc(db, 'onBarInventory', id);
        await runTransaction(db, async (transaction) => {
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists()) {
                throw new Error("Item not found on bar.");
            }
            const itemData = itemDoc.data() as OnBarItem;
            const isBeer = itemData.category === 'Beer';

            const soldAmount = itemData.salesVolume || 0;
            const amountToRefill = isBeer ? 1 : amount; // For beer, always refill 1 unit

            if (soldAmount < amountToRefill) {
                throw new Error("Cannot refill more than what was sold.");
            }

            const newRemainingVolume = itemData.remainingVolume + amountToRefill;
            const totalCapacity = isBeer ? (itemData.totalQuantity || 0) : itemData.totalVolume;
            if (newRemainingVolume > totalCapacity) {
                throw new Error("Refill amount exceeds bottle capacity.");
            }
            
            const valueToRefund = isBeer 
                ? itemData.price // Refunding one beer bottle
                : ((itemData.salesValue || 0) / (soldAmount || 1)) * amountToRefill; // Avg price for liquor
            
            const newSalesVolume = soldAmount - amountToRefill;
            const newSalesValue = (itemData.salesValue || 0) - valueToRefund;

            transaction.update(itemRef, {
                remainingVolume: newRemainingVolume,
                salesVolume: Math.max(0, newSalesVolume),
                salesValue: Math.max(0, newSalesValue),
            });
        });
    } catch (error) {
        console.error("Error refilling peg: ", error);
        throw error;
    } finally {
        setSaving(false);
    }
  };

 const removeOnBarItem = async (id: string) => {
      if(saving) return;
      setSaving(true);
      try {
          await runTransaction(db, async (transaction) => {
            const onBarItemRef = doc(db, "onBarInventory", id);
            const onBarItemDoc = await transaction.get(onBarItemRef);

            if (!onBarItemDoc.exists()) {
                throw new Error("On-bar item not found.");
            }

            const onBarItemData = onBarItemDoc.data() as OnBarItem;

            // Only return stock if nothing has been sold from this item
            if (onBarItemData.salesVolume === 0) {
                const inventoryId = onBarItemData.inventoryId;

                // Make sure this isn't a manually added item
                if (inventoryId && inventoryId !== 'manual') {
                    const masterInventoryRef = doc(db, "inventory", inventoryId);
                    const masterInventoryDoc = await transaction.get(masterInventoryRef);
                    
                    if (masterInventoryDoc.exists()) {
                        const masterData = masterInventoryDoc.data();
                        const currentGodownStock = masterData.stockInGodown || 0;
                        const quantityToReturn = onBarItemData.category === 'Beer'
                            ? onBarItemData.remainingVolume // Return all remaining units
                            : 1; // Return 1 bottle

                        transaction.update(masterInventoryRef, {
                            stockInGodown: currentGodownStock + quantityToReturn
                        });
                    }
                }
            }
            
            // Delete the on-bar item regardless of whether stock was returned
            transaction.delete(onBarItemRef);
          });
          
          // forceRefetch from the main inventory hook to update UI
          await forceRefetch();

      } catch (error) {
          console.error("Error removing on-bar item: ", error);
          throw error;
      } finally {
          setSaving(false);
      }
  }

  return { onBarInventory, loading, saving, addOnBarItem, sellPeg, refillPeg, removeOnBarItem };
}
