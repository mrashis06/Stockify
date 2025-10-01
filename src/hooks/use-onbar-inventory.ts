
"use client";

// This file is deprecated. All logic has been moved to src/hooks/use-inventory.ts
// It is kept for reference and to prevent breaking imports, but it should not be used directly.

import { useInventory } from './use-inventory';
export type { OnBarItem } from './use-inventory';


export function useOnBarInventory() {
    const { onBarInventory, loading, saving, addOnBarItem, sellPeg, refillPeg, removeOnBarItem } = useInventory();
    return { onBarInventory, loading, saving, addOnBarItem, sellPeg, refillPeg, removeOnBarItem };
}
