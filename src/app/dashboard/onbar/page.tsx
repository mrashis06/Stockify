
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Minus, Plus, GlassWater, Loader2, Wine, Beer, IndianRupee, Trash2, LogOut, Warehouse, Archive } from 'lucide-react';
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
import { useInventory, OnBarItem } from '@/hooks/use-inventory';
import AddOnBarItemDialog from '@/components/dashboard/add-onbar-item-dialog';
import SellOnBarItemDialog from '@/components/dashboard/sell-onbar-item-dialog';
import { usePageLoading } from '@/hooks/use-loading';
import { useDateFormat } from '@/hooks/use-date-format';
import { cn } from '@/lib/utils';
import SelectionActionBar from '@/components/dashboard/selection-action-bar';

const RealTimeClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="font-mono font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">
      {formatTime(time)}
    </div>
  );
};

export default function OnBarPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
    const { 
        inventory: shopInventory, 
        onBarInventory, 
        dailyOnBarSales,
        loading, 
        saving,
        sellPeg, 
        removeOnBarItem, 
        refillPeg, 
        addOnBarItem,
        totalOnBarSales,
        endOfDayOnBar,
        onBarNeedsEOD,
        resetOnBarEOD,
    } = useInventory();
    
    const { toast } = useToast();
    const { formatDate } = useDateFormat();
    
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
            await sellPeg(id, 'custom', volume, price);
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
    
    const handleOneClickSell = async (item: OnBarItem, pegSize: 30 | 60) => {
        try {
            await sellPeg(item.id, pegSize);
            const price = pegSize === 30 ? item.pegPrice30ml : item.pegPrice60ml;
            toast({ title: 'Success', description: `${pegSize}ml sold for ₹${price}.` });
        } catch (error) {
            console.error(`Error selling ${pegSize}ml peg:`, error);
            const errorMessage = (error as Error).message || `Failed to sell ${pegSize}ml peg.`;
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };

    const handleRefill = async (id: string) => {
        try {
            const item = onBarInventory.find(i => i.id === id);
            if (!item) return;

            const refillAmount = item.category === 'Beer' ? 1 : 30;
            await refillPeg(id, refillAmount); 
            
            const message = item.category === 'Beer' ? 'Last beer sale cancelled.' : `Last sale of 30ml cancelled.`;
            toast({ title: 'Success', description: message });
        } catch (error) {
            console.error('Error refilling item:', error);
            const errorMessage = (error as Error).message || 'Failed to refill item.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    };

    const handleRemove = async (id: string) => {
         try {
            const item = onBarInventory.find(i => i.id === id);
            await removeOnBarItem(id);
            toast({ title: 'Item Removed', description: `${item?.brand} (${item?.size}) removed from bar.` });
        } catch (error) {
            console.error('Error removing item:', error);
            const errorMessage = (error as Error).message || 'Failed to remove item.';
            toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        }
    }
    
    const handleEndOfDay = async () => {
        setIsEndOfDayDialogOpen(false);
        try {
            await endOfDayOnBar();
            resetOnBarEOD(); // Reset the glow effect
            toast({
                title: 'On-Bar EOD Processed',
                description: "Today's closing volumes have been set as tomorrow's opening volumes for all open bottles."
            });
        } catch (error) {
            console.error("On-Bar end of day process failed:", error);
            toast({
                title: 'End of Day Failed',
                description: (error as Error).message || 'An unexpected error occurred.',
                variant: 'destructive',
            });
        }
    };
    
    if (loading) {
        return null;
    }

    return (
        <main className={cn("flex-1 p-4 md:p-8", onBarNeedsEOD && "pb-24")}>
             {onBarNeedsEOD && (
                <SelectionActionBar
                    count={0} // Special case for EOD
                    onClear={() => {}}
                    isEodReminder
                >
                    <div className="flex-1 text-center font-medium">On-Bar EOD required.</div>
                    <Button onClick={() => setIsEndOfDayDialogOpen(true)} size="sm" variant="default">
                        <LogOut className="mr-2 h-4 w-4" /> Finalize Sales
                    </Button>
                </SelectionActionBar>
            )}
            <AddOnBarItemDialog
                isOpen={isAddItemOpen}
                onOpenChange={setIsAddItemOpen}
                onAddItem={addOnBarItem}
                shopInventory={shopInventory}
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
                        <AlertDialogTitle>On-Bar End of Day</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will reset today's sales for open bottles and set their opening stock for tomorrow to what's currently remaining. This action only affects on-bar items. Continue?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleEndOfDay} disabled={saving}>
                             {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Confirm End of Day
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">On-Bar Inventory</h1>
                    <div className="flex items-center gap-2">
                        <p className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">{formatDate(new Date(), 'dd-MMM-yyyy, EEEE')}</p>
                        <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">&bull;</span>
                        <RealTimeClock />
                    </div>
                </div>
                <div className="flex w-full sm:w-auto flex-col sm:flex-row gap-2">
                    <Button onClick={() => setIsAddItemOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
                        <Plus className="mr-2 h-4 w-4" /> Open a Bottle
                    </Button>
                    <Button 
                        onClick={() => setIsEndOfDayDialogOpen(true)} 
                        variant="outline" 
                        className="bg-blue-600 hover:bg-blue-700 text-white" 
                        disabled={saving}>
                        <LogOut className="mr-2 h-4 w-4" /> End of Day
                    </Button>
                </div>
            </header>

             <div className="md:hidden grid grid-cols-2 gap-2 mb-6">
                <Button variant="outline" asChild>
                    <Link href="/dashboard/godown">
                        <Archive className="mr-2 h-4 w-4" />
                        Godown
                    </Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href="/dashboard/inventory">
                        <Warehouse className="mr-2 h-4 w-4" />
                        Off-Counter
                    </Link>
                </Button>
            </div>
            
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
                        Click "Open a Bottle" to add an item from your inventory to start tracking sales.
                    </p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {onBarInventory.map(item => {
                        const isBeer = item.category === 'Beer';
                        const remaining = item.remainingVolume;
                        const total = isBeer ? (item.totalQuantity || 1) : item.totalVolume;
                        const unitLabel = isBeer ? 'units' : 'ml';
                        const canSell30 = !isBeer && remaining >= 30 && item.pegPrice30ml !== undefined;
                        const canSell60 = !isBeer && remaining >= 60 && item.pegPrice60ml !== undefined;
                        
                        const dailySaleRecord = dailyOnBarSales.find(sale => sale.id === `on-bar-${item.inventoryId}`);
                        const todaysSalesVolume = dailySaleRecord?.salesVolume || 0;
                        const isRefillable = isBeer 
                            ? todaysSalesVolume >= 1
                            : todaysSalesVolume >= 30;

                        return (
                        <Card key={item.id} className="flex flex-col h-full relative">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-lg whitespace-normal break-words pr-8">{item.brand}</CardTitle>
                                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8" onClick={() => handleRemove(item.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </CardHeader>
                             <CardContent className="flex-1 flex flex-col justify-between p-6 pt-0">
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
                                     {!isBeer ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button onClick={() => handleOneClickSell(item, 30)} disabled={!canSell30}>
                                                Sell 30ml
                                            </Button>
                                            <Button onClick={() => handleOneClickSell(item, 60)} disabled={!canSell60}>
                                                Sell 60ml
                                            </Button>
                                        </div>
                                     ) : null}

                                     <Button
                                        variant="outline"
                                        className="w-full"
                                        disabled={remaining <= 0}
                                        onClick={() => handleOpenSellDialog(item)}
                                    >
                                        {isBeer ? <Beer className="mr-2 h-4 w-4" /> : <Minus className="mr-2 h-4 w-4" />}
                                        {isBeer ? 'Sell Beer' : 'Custom Sale'}
                                    </Button>

                                     <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleRefill(item.id)}
                                        disabled={remaining >= total || !isRefillable}
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
