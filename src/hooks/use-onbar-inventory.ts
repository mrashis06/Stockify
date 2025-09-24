
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
  addDoc
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
  totalVolume: number; // e.g., 750 for a 750ml bottle
  remainingVolume: number;
  salesVolume: number; // Volume sold today in ml
  salesValue: number; // Monetary value of sales today
  price: number; // Price of the full bottle
  openedAt: any; // Firestore Timestamp
};

export type OnBarManualItem = Omit<OnBarItem, 'id' | 'inventoryId' | 'remainingVolume' | 'salesVolume' | 'salesValue' | 'price' | 'openedAt'>;

export function useOnBarInventory() {
  const [onBarInventory, setOnBarInventory] = useState<OnBarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { openBottleForOnBar } = useInventory();

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

  const addOnBarItem = async (inventoryItemId: string, volume: number) => {
      if (saving) return;
      setSaving(true);
      try {
          await openBottleForOnBar(inventoryItemId, volume);
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
          await addDoc(collection(db, "onBarInventory"), {
              ...manualItem,
              inventoryId: 'manual',
              remainingVolume: manualItem.totalVolume,
              salesVolume: 0,
              salesValue: 0,
              price: 0,
              openedAt: serverTimestamp(),
          });
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
            if (newRemainingVolume > itemData.totalVolume) {
                // This case should ideally not happen if salesVolume is tracked correctly
                throw new Error("Refill amount exceeds bottle capacity.");
            }
            
            // This is a simplification. A more robust implementation would need to know
            // the value of the specific sale being reversed. For now, we reduce by average cost.
            const averagePricePerMl = (itemData.salesValue || 0) / (itemData.salesVolume || 1);
            const valueToRefund = averagePricePerMl * amount;
            
            const newSalesVolume = (itemData.salesVolume || 0) - amount;
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
