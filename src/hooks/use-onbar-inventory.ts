
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
  getDoc
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
  salesVolume: number; // Volume sold today in ml
  salesValue: number; // Monetary value of sales today
  price: number; // Price of the full bottle
  openedAt: any; // Firestore Timestamp
};

export type OnBarManualItem = Omit<OnBarItem, 'id' | 'inventoryId' | 'remainingVolume' | 'salesVolume' | 'salesValue' | 'openedAt'> & { quantity: number };

export function useOnBarInventory() {
  const [onBarInventory, setOnBarInventory] = useState<OnBarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { inventory, updateItemField } = useInventory();

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

  const addOnBarItem = async (inventoryItemId: string, volume: number, quantity: number = 1) => {
      if (saving) return;
      setSaving(true);
      try {
        const itemInShop = inventory.find(item => item.id === inventoryItemId);
        if (!itemInShop) throw new Error("Item not found in shop inventory.");
        
        const currentSales = itemInShop.sales || 0;
        const opening = (itemInShop.prevStock || 0) + (itemInShop.added || 0);
        const closingStock = opening - currentSales;

        if (closingStock < quantity) {
            throw new Error(`Not enough stock. Available: ${closingStock}, trying to open: ${quantity}`);
        }

        // Treat opening a bottle as a "sale" from the main inventory
        await updateItemField(inventoryItemId, 'sales', currentSales + quantity);
        
        // Then, add the bottle(s) to the on-bar collection
        const batch = writeBatch(db);
        const onBarCollectionRef = collection(db, "onBarInventory");

        for (let i = 0; i < quantity; i++) {
            const newOnBarDocRef = doc(onBarCollectionRef);
             batch.set(newOnBarDocRef, {
                inventoryId: inventoryItemId,
                brand: itemInShop.brand,
                size: itemInShop.size,
                category: itemInShop.category,
                totalVolume: volume,
                remainingVolume: volume,
                salesVolume: 0,
                salesValue: 0,
                price: itemInShop.price,
                openedAt: serverTimestamp(),
            });
        }
        await batch.commit();

      } catch (error) {
          console.error("Error opening bottle: ", error);
          throw error;
      } finally {
          setSaving(false);
      }
  };

  const addOnBarItemManual = async (manualItem: OnBarManualItem) => {
      if (saving) return;
      setSaving(true);
      try {
          const onBarCollectionRef = collection(db, "onBarInventory");
          
          if (manualItem.category === 'Beer') {
              // Create a single item for a group of beers
              await addDoc(onBarCollectionRef, {
                  brand: manualItem.brand,
                  size: manualItem.size,
                  category: manualItem.category,
                  totalVolume: manualItem.totalVolume, // This is the volume of ONE bottle
                  price: manualItem.price || 0,
                  inventoryId: 'manual',
                  remainingVolume: manualItem.quantity, // remainingVolume tracks UNITS for beer
                  totalQuantity: manualItem.quantity,   // totalQuantity tracks total UNITS
                  salesVolume: 0, // salesVolume will track units sold
                  salesValue: 0,
                  openedAt: serverTimestamp(),
              });
          } else {
              // Create a single item for one bottle of liquor
              await addDoc(onBarCollectionRef, {
                  brand: manualItem.brand,
                  size: manualItem.size,
                  category: manualItem.category,
                  totalVolume: manualItem.totalVolume,
                  price: manualItem.price || 0,
                  inventoryId: 'manual',
                  remainingVolume: manualItem.totalVolume,
                  salesVolume: 0,
                  salesValue: 0,
                  openedAt: serverTimestamp(),
              });
          }

      } catch(error) {
          console.error("Error adding manual on-bar item:", error);
          throw error;
      } finally {
          setSaving(false);
      }
  };

  const sellCustomPeg = async (id: string, volume: number, price: number) => {
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

        if (itemData.category === 'Beer') {
            // Selling a beer decrements remainingVolume (which is units) by 1
            if (itemData.remainingVolume < 1) {
                throw new Error("No more bottles to sell.");
            }
            const newRemainingUnits = itemData.remainingVolume - 1;
            const newSalesUnits = (itemData.salesVolume || 0) + 1;
            const newSalesValue = (itemData.salesValue || 0) + itemData.price; // Use the stored price per bottle
            
            transaction.update(itemRef, {
                remainingVolume: newRemainingUnits,
                salesVolume: newSalesUnits,
                salesValue: newSalesValue,
            });

        } else {
            // Selling a liquor peg
            if (itemData.remainingVolume < volume) {
              throw new Error("Not enough liquor remaining to sell this peg.");
            }
            
            const newRemainingVolume = itemData.remainingVolume - volume;
            const newSalesVolume = (itemData.salesVolume || 0) + volume;
            const newSalesValue = (itemData.salesValue || 0) + price;
            
            transaction.update(itemRef, { 
                remainingVolume: newRemainingVolume,
                salesVolume: newSalesVolume,
                salesValue: newSalesValue,
            });
        }
      });
    } catch (error) {
      console.error("Error selling custom peg: ", error);
      throw error;
    } finally {
      setSaving(false);
    }
  };


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

            if ((itemData.salesVolume || 0) < amount) {
                throw new Error("Cannot refill more than what was sold.");
            }

            const newRemainingVolume = itemData.remainingVolume + amount;
            if (newRemainingVolume > (itemData.category === 'Beer' ? (itemData.totalQuantity || 0) : itemData.totalVolume)) {
                throw new Error("Refill amount exceeds bottle capacity.");
            }
            
            const valueToRefund = itemData.category === 'Beer' 
                ? itemData.price // Refunding one beer bottle
                : ((itemData.salesValue || 0) / (itemData.salesVolume || 1)) * amount; // Avg price for liquor
            
            const newSalesVolume = (itemData.salesVolume || 0) - (itemData.category === 'Beer' ? 1 : amount);
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
          const itemRef = doc(db, 'onBarInventory', id);
          const itemSnap = await getDoc(itemRef);
          if (!itemSnap.exists()) throw new Error("On-bar item not found");
          const onBarItemData = itemSnap.data() as OnBarItem;
          const inventoryId = onBarItemData.inventoryId;

          if (inventoryId && inventoryId !== 'manual') {
              const itemInShop = inventory.find(item => item.id === inventoryId);
              if (itemInShop) {
                  const currentSales = itemInShop.sales || 0;
                  const quantityToReturn = onBarItemData.category === 'Beer' ? onBarItemData.remainingVolume : 1;
                  
                  if (onBarItemData.remainingVolume > 0) {
                    await updateItemField(inventoryId, 'sales', Math.max(0, currentSales - quantityToReturn));
                  }
              }
          }
          
          await deleteDoc(itemRef);

      } catch (error) {
          console.error("Error removing on-bar item: ", error);
          throw error;
      } finally {
          setSaving(false);
      }
  }

  return { onBarInventory, loading, saving, addOnBarItem, addOnBarItemManual, sellCustomPeg, refillPeg, removeOnBarItem };
}
