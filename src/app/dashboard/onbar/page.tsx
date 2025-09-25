
"use client";

import React, { useState, useMemo } from 'react';
import { Minus, Plus, GlassWater, Loader2, Wine, Beer, IndianRupee, Trash2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { useOnBarInventory, OnBarItem } from '@/hooks/use-onbar-inventory';
import AddOnBarItemDialog from '@/components/dashboard/add-onbar-item-dialog';
import SellOnBarItemDialog from '@/components/dashboard/sell-onbar-item-dialog';
import { useInventory } from '@/hooks/use-inventory';
import { usePageLoading } from '@/hooks/use-loading';
import { useEndOfDay } from '@/hooks/use-end-of-day';

export default function OnBarPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
    const { onBarInventory, loading, sellCustomPeg, removeOnBarItem, refillPeg } = useOnBarInventory();
    const { inventory: shopInventory } = useInventory();
    const { isEndingDay, endOfDayProcess } = useEndOfDay();
    const { toast } = useToast();
    
    usePageLoading(loading);

    const [isAddItemOpen, setIsAddItemOpen] = useState(false);
    const [isSellItemOpen, setIsSellItemOpen] = useState(false);
    const [sellingItem, setSellingItem] = useState<OnBarItem | null>(null);
    const [isEndOfDayDialogOpen, setIsEndOfDayDialogOpen] = useState(false);

    const handleOpenSellDialog = (item: OnBarItem) => {
        setSellingItem(item);
        setIsSellItemOpen(true);
    };
    
    const handleSell = async (id: string, volume: number, price: number) => {
        try {
            await sellCustomPeg(id, volume, price);
            const item = onBarInventory.find(i => i.id === id);
            const message = item?.category === 'Beer' ? `${volume} unit(s) sold for ₹${price}.` : `${volume}ml sold for ₹${price}.`;
            toast({ title: 'Success', description: message });
            setIsSellItemOpen(false);
        } catch (error) {
            console.error('Error selling item:', error);
            const errorMessage = (error as Error).message || 'Failed to sell item.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };

    const handleRefill = async (id: string, amount: number) => {
        try {
            const item = onBarInventory.find(i => i.id === id);
            const refillAmount = item?.category === 'Beer' ? 1 : 30; // Refill 1 unit for beer, 30ml for liquor
            await refillPeg(id, refillAmount); 
            const message = item?.category === 'Beer' ? 'Last beer sale cancelled.' : `Last sale of 30ml cancelled.`;
            toast({ title: 'Success', description: message });
        } catch (error) {
            console.error('Error refilling item:', error);
            const errorMessage = (error as Error).message || 'Failed to refill item.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };

    const handleRemove = async (id: string) => {
         try {
            await removeOnBarItem(id);
            toast({ title: 'Success', description: 'Bottle removed and stock returned.' });
        } catch (error) {
            console.error('Error removing item:', error);
            const errorMessage = (error as Error).message || 'Failed to remove item.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    }
    
    const handleEndOfDay = async () => {
        setIsEndOfDayDialogOpen(false);
        try {
            await endOfDayProcess();
            toast({
                title: 'End of Day Successful',
                description: 'Today\'s inventory has been closed and tomorrow\'s has been prepared.'
            });
        } catch (error) {
            console.error("End of day process failed:", error);
            toast({
                title: 'End of Day Failed',
                description: (error as Error).message || 'An unexpected error occurred.',
                variant: 'destructive',
            });
        }
    };

    const totalOnBarSales = useMemo(() => {
        return onBarInventory.reduce((total, item) => total + (item.salesValue || 0), 0);
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
            />

            {sellingItem && (
                <SellOnBarItemDialog
                    isOpen={isSellItemOpen}
                    onOpenChange={setIsSellItemOpen}
                    item={sellingItem}
                    onSell={handleSell}
                />
            )}

            <AlertDialog open={isEndOfDayDialogOpen} onOpenChange={setIsEndOfDayDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>End of Day Process</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to close today's inventory? This will finalize all sales and stock for today and prepare the inventory for tomorrow. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleEndOfDay} disabled={isEndingDay}>
                             {isEndingDay ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Confirm End of Day
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <h1 className="text-2xl font-bold tracking-tight">On-Bar Inventory</h1>
                <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
                    <Button onClick={() => setIsAddItemOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
                        <Plus className="mr-2 h-4 w-4" /> Open a Bottle
                    </Button>
                    <Button onClick={() => setIsEndOfDayDialogOpen(true)} variant="outline" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={isEndingDay}>
                        <LogOut className="mr-2 h-4 w-4" /> End of Day
                    </Button>
                </div>
            </header>
            
             <Card className="mb-6 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
                <CardHeader>
                    <CardTitle className="text-lg font-medium text-primary">Today's On-Bar Sales</CardTitle>
                    <CardDescription>Total value of pegs and bottles sold from open inventory today.</CardDescription>
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
                        Click "Open a Bottle" to add an item from your inventory or manually to start tracking sales.
                    </p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {onBarInventory.map(item => {
                        const isBeer = item.category === 'Beer';
                        const remaining = item.remainingVolume;
                        const total = isBeer ? (item.totalQuantity || 1) : item.totalVolume;
                        const unitLabel = isBeer ? 'units' : 'ml';
                        const beerSaleQuantities = [1, 2, 3, 4, 6];

                        return (
                        <Card key={item.id} className="flex flex-col h-full relative">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-lg truncate pr-8">{item.brand}</CardTitle>
                                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => handleRemove(item.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </CardHeader>
                             <CardContent className="flex-1 flex flex-col justify-between p-6">
                                <div className="text-center flex-1 flex flex-col justify-center">
                                    <div className="flex justify-center items-baseline gap-2">
                                        <span className="text-5xl font-bold tracking-tighter">{Math.max(0, remaining)}</span>
                                        <span className="text-xl font-normal text-muted-foreground">{unitLabel}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Remaining</p>
                                    <div className="my-6">
                                        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                                            <div
                                                className="absolute top-0 left-0 h-full bg-primary transition-all duration-300"
                                                style={{ width: `${(remaining / total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                     <Button
                                        variant="outline"
                                        className="w-full"
                                        disabled={remaining <= 0}
                                        onClick={() => handleOpenSellDialog(item)}
                                    >
                                        {isBeer ? <Beer className="mr-2 h-4 w-4" /> : <Minus className="mr-2 h-4 w-4" />}
                                        {isBeer ? 'Sell Beer' : 'Sell Peg'}
                                    </Button>

                                     <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleRefill(item.id, 30)}
                                        disabled={remaining >= total || (item.salesVolume || 0) < (isBeer ? 1 : 30)}
                                        className="shrink-0 absolute bottom-6 right-6"
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                    
                                    {remaining <= 0 && (
                                        <Button
                                            variant="destructive"
                                            className="w-full"
                                            onClick={() => handleRemove(item.id)}
                                        >
                                           Remove Empty Item(s)
                                        </Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )})}
                </div>
            )}
        </main>
    );
}
