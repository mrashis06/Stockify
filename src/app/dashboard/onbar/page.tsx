
"use client";

import React, { useState, useMemo } from 'react';
import { Minus, Plus, GlassWater, Loader2, Wine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useOnBarInventory, OnBarItem } from '@/hooks/use-onbar-inventory';
import AddOnBarItemDialog from '@/components/dashboard/add-onbar-item-dialog';
import { useInventory } from '@/hooks/use-inventory';

export default function OnBarPage() {
    const { onBarInventory, loading, sellPeg, removeOnBarItem } = useOnBarInventory();
    const { inventory: shopInventory } = useInventory();
    const { toast } = useToast();

    const [isAddItemOpen, setIsAddItemOpen] = useState(false);

    const handleAddOnBarItem = async (inventoryItemId: string, volume: number) => {
        try {
            // The logic is now within the hook, so we just call it
            toast({ title: 'Success', description: 'Bottle opened and moved to OnBar.' });
        } catch (error) {
            console.error('Error opening bottle:', error);
            const errorMessage = (error as Error).message || 'Failed to open bottle.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };
    
    const handleSellPeg = async (id: string, pegSize: number) => {
        try {
            await sellPeg(id, pegSize);
            toast({ title: 'Success', description: `${pegSize}ml peg sold.` });
        } catch (error) {
            console.error('Error selling peg:', error);
            const errorMessage = (error as Error).message || 'Failed to sell peg.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };

    const handleRemove = async (id: string) => {
         try {
            await removeOnBarItem(id);
            toast({ title: 'Success', description: 'Empty bottle removed.' });
        } catch (error) {
            console.error('Error removing item:', error);
            const errorMessage = (error as Error).message || 'Failed to remove item.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    }

    return (
        <main className="flex-1 p-4 md:p-8">
            <AddOnBarItemDialog
                isOpen={isAddItemOpen}
                onOpenChange={setIsAddItemOpen}
                shopInventory={shopInventory}
                onBarInventory={onBarInventory}
                onAddItem={handleAddOnBarItem}
            />

            <header className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold tracking-tight">On-Bar Inventory</h1>
                <Button onClick={() => setIsAddItemOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="mr-2 h-4 w-4" /> Open a Bottle
                </Button>
            </header>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-4 text-muted-foreground">Loading On-Bar Stock...</span>
                </div>
            ) : onBarInventory.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <Wine className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No Open Bottles</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Click "Open a Bottle" to add an item from your inventory to start tracking peg sales.
                    </p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {onBarInventory.map(item => (
                        <Card key={item.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="text-lg">{item.brand} <span className="text-sm font-normal text-muted-foreground">({item.size})</span></CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col justify-between">
                                <div>
                                    <div className="relative h-4 bg-muted rounded-full overflow-hidden mb-4">
                                        <div
                                            className="absolute top-0 left-0 h-full bg-primary transition-all duration-300"
                                            style={{ width: `${(item.remainingVolume / item.totalVolume) * 100}%` }}
                                        />
                                    </div>
                                    <div className="text-center mb-6">
                                        <p className="text-3xl font-bold">{item.remainingVolume}<span className="text-lg font-normal text-muted-foreground"> / {item.totalVolume}ml</span></p>
                                        <p className="text-sm text-muted-foreground">Remaining</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                     <div className="flex justify-around gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => handleSellPeg(item.id, 30)}
                                            disabled={item.remainingVolume < 30}
                                            className="flex-1"
                                        >
                                            <Minus className="h-4 w-4 mr-2" /> 30ml
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => handleSellPeg(item.id, 60)}
                                            disabled={item.remainingVolume < 60}
                                            className="flex-1"
                                        >
                                            <Minus className="h-4 w-4 mr-2" /> 60ml
                                        </Button>
                                         <Button
                                            variant="outline"
                                            onClick={() => handleSellPeg(item.id, 90)}
                                            disabled={item.remainingVolume < 90}
                                            className="flex-1"
                                        >
                                            <Minus className="h-4 w-4 mr-2" /> 90ml
                                        </Button>
                                    </div>
                                    {item.remainingVolume <= 0 && (
                                        <Button
                                            variant="destructive"
                                            className="w-full"
                                            onClick={() => handleRemove(item.id)}
                                        >
                                           Remove Empty Bottle
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </main>
    );
}

