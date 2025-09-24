
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
  price: number; // Price of the full bottle
  openedAt: any; // Firestore Timestamp
};

export type OnBarManualItem = Omit<OnBarItem, 'id' | 'inventoryId' | 'remainingVolume' | 'salesVolume' | 'price' | 'openedAt'>;

export function useOnBarInventory() {
  const [onBarInventory, setOnBarInventory] = useState<OnBarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { openBottleForOnBar } = useInventory(); // Get the function to update main inventory

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

  // This function is now mostly a wrapper around the one in useInventory
  const addOnBarItem = async (inventoryItemId: string, volume: number) => {
      if (saving) return;
      setSaving(true);
      try {
          // This function now handles the entire transaction
          await openBottleForOnBar(inventoryItemId, volume);
      } catch (error) {
          console.error("Error opening bottle: ", error);
          throw error; // Re-throw to be caught in the component
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
              inventoryId: 'manual', // Mark as a manual entry
              remainingVolume: manualItem.totalVolume,
              salesVolume: 0,
              price: 0, // Manual items won't have a price for sales calculation
              openedAt: serverTimestamp(),
          });
      } catch(error) {
          console.error("Error adding manual on-bar item:", error);
          throw error;
      } finally {
          setSaving(false);
      }
  };

  const sellPeg = async (id: string, pegSize: number) => {
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
        const currentVolume = itemData.remainingVolume;
        
        if (currentVolume < pegSize) {
          throw new Error("Not enough liquor remaining to sell this peg.");
        }
        
        const newVolume = currentVolume - pegSize;
        const newSalesVolume = (itemData.salesVolume || 0) + pegSize;
        
        transaction.update(itemRef, { 
            remainingVolume: newVolume,
            salesVolume: newSalesVolume
        });
      });
    } catch (error) {
      console.error("Error selling peg: ", error);
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

            // Ensure we don't refill more than was sold or more than the bottle's total volume
            const effectiveAmount = Math.min(amount, itemData.salesVolume || 0);
            if (effectiveAmount <= 0) return;

            let newRemainingVolume = itemData.remainingVolume + effectiveAmount;
            if (newRemainingVolume > itemData.totalVolume) {
                newRemainingVolume = itemData.totalVolume;
            }

            const newSalesVolume = (itemData.salesVolume || 0) - (newRemainingVolume - itemData.remainingVolume);
            
            transaction.update(itemRef, {
                remainingVolume: newRemainingVolume,
                salesVolume: Math.max(0, newSalesVolume)
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

  return { onBarInventory, loading, saving, addOnBarItem, addOnBarItemManual, sellPeg, refillPeg, removeOnBarItem };
}
