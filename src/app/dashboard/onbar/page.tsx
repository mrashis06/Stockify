
"use client";

import React, { useState, useMemo } from 'react';
import { Minus, Plus, GlassWater, Loader2, Wine, Beer, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useOnBarInventory, OnBarItem } from '@/hooks/use-onbar-inventory';
import AddOnBarItemDialog from '@/components/dashboard/add-onbar-item-dialog';
import SellPegDialog from '@/components/dashboard/sell-peg-dialog';
import { useInventory } from '@/hooks/use-inventory';
import { usePageLoading } from '@/hooks/use-loading';

export default function OnBarPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
    const { onBarInventory, loading, sellPeg, removeOnBarItem, refillPeg } = useOnBarInventory();
    const { inventory: shopInventory } = useInventory();
    const { toast } = useToast();
    
    usePageLoading(loading);

    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [isSellPegOpen, setIsSellPegOpen] = useState(false);
    const [sellingItem, setSellingItem] = useState<OnBarItem | null>(null);


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

    const handleOpenSellDialog = (item: OnBarItem) => {
        setSellingItem(item);
        setIsSellPegOpen(true);
    };
    
    const handleSell = async (id: string, volume: number) => {
        try {
            await sellPeg(id, volume);
            toast({ title: 'Success', description: `${volume}ml sold.` });
            setIsSellPegOpen(false);
        } catch (error) {
            console.error('Error selling item:', error);
            const errorMessage = (error as Error).message || 'Failed to sell item.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };

    const handleRefill = async (id: string, amount: number) => {
        try {
            await refillPeg(id, amount);
            toast({ title: 'Success', description: `Last sale of ${amount}ml cancelled.` });
        } catch (error)
        {
            console.error('Error refilling item:', error);
            const errorMessage = (error as Error).message || 'Failed to refill item.';
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

    const totalOnBarSales = useMemo(() => {
        return onBarInventory.reduce((total, item) => {
            if (item.salesVolume > 0 && item.price > 0 && item.totalVolume > 0) {
                const pricePerMl = item.price / item.totalVolume;
                return total + (item.salesVolume * pricePerMl);
            }
            return total;
        }, 0);
    }, [onBarInventory]);
    
    if (loading) {
        return null;
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
            {sellingItem && (
                <SellPegDialog
                    isOpen={isSellPegOpen}
                    onOpenChange={setIsSellPegOpen}
                    item={sellingItem}
                    onSell={handleSell}
                />
            )}

            <header className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold tracking-tight">On-Bar Inventory</h1>
                <Button onClick={() => setIsAddItemOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
                    <Plus className="mr-2 h-4 w-4" /> Open a Bottle
                </Button>
            </header>
            
             <Card className="mb-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
                <CardHeader>
                    <CardTitle className="text-lg font-medium text-primary">Today's On-Bar Sales</CardTitle>
                    <CardDescription>Total value of pegs sold from open bottles today.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-bold text-foreground flex items-center">
                        <IndianRupee className="h-7 w-7 mr-2" />
                        {totalOnBarSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </CardContent>
            </Card>

            {onBarInventory.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed rounded-lg">
                    <Wine className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No Open Bottles</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Click "Open a Bottle" to add an item from your inventory or manually to start tracking peg sales.
                    </p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {onBarInventory.map(item => (
                        <Card key={item.id} className="flex flex-col h-full">
                            <CardHeader>
                                <CardTitle className="text-lg truncate">{item.brand}</CardTitle>
                            </CardHeader>
                             <CardContent className="flex-1 flex flex-col justify-between p-6">
                                <div className="text-center flex-1 flex flex-col justify-center">
                                    <p className="text-5xl font-bold tracking-tighter">{Math.max(0, item.remainingVolume)}<span className="text-xl font-normal text-muted-foreground">ml</span></p>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Remaining</p>
                                    <div className="my-6">
                                        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="absolute top-0 left-0 h-full bg-primary transition-all duration-300"
                                                style={{ width: `${(item.remainingVolume / item.totalVolume) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                     {item.category === 'Beer' ? (
                                        <Button
                                            variant="outline"
                                            onClick={() => handleSell(item.id, item.totalVolume)}
                                            disabled={item.remainingVolume <= 0}
                                            className="w-full"
                                        >
                                            <Beer className="mr-2 h-4 w-4" /> Sell Bottle
                                        </Button>
                                     ) : (
                                        <div className="flex justify-center items-center gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                disabled={item.remainingVolume <= 0}
                                                onClick={() => handleOpenSellDialog(item)}
                                            >
                                                <Minus className="mr-2 h-4 w-4" />
                                                Sell Peg
                                            </Button>
                                            
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handleRefill(item.id, 30)}
                                                disabled={item.remainingVolume >= item.totalVolume || (item.salesVolume || 0) < 30}
                                                className="shrink-0"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                     )}
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
