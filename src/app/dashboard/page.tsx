
"use client";

import { IndianRupee, PackageCheck, TriangleAlert } from "lucide-react";
import Image from "next/image";
import Link from 'next/link';
import { useEffect, useState, useMemo } from "react";
import { doc, onSnapshot, collection, getDocs, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subDays } from 'date-fns';
import { useDateFormat } from "@/hooks/use-date-format";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PlaceHolderImages } from "@/lib/placeholder-images";
import type { InventoryItem } from "@/hooks/use-inventory";
import { usePageLoading } from "@/hooks/use-loading";
import LowStockDialog from "@/components/dashboard/low-stock-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";


const categories = [
  { name: "Whiskey", imageId: "whiskey-bottle" },
  { name: "Rum", imageId: "rum-bottle" },
  { name: "Vodka", imageId: "vodka-bottle" },
  { name: "Beer", imageId: "beer-bottle" },
  { name: "Wine", imageId: "wine-bottle" },
  { name: "IML", imageId: "iml-bottle" },
];

export default function DashboardPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [todaySalesData, setTodaySalesData] = useState<any>({});
  const [yesterdaySalesData, setYesterdaySalesData] = useState<any>({});
  const { formatDate } = useDateFormat();
  const [isLowStockDialogOpen, setIsLowStockDialogOpen] = useState(false);
  
  usePageLoading(loading);
  const yesterday = useMemo(() => subDays(new Date(), 1), []);
  const yesterdayString = useMemo(() => formatDate(yesterday, 'yyyy-MM-dd'), [yesterday, formatDate]);


  useEffect(() => {
    const today = formatDate(new Date(), 'yyyy-MM-dd');
    const yesterdayDateStr = formatDate(subDays(new Date(), 1), 'yyyy-MM-dd');
    
    // Listener for today's data to keep sales figures live.
    const dailyDocRef = doc(db, 'dailyInventory', today);
    const unsubscribeDaily = onSnapshot(dailyDocRef, (dailySnap) => {
        const dailyData = dailySnap.exists() ? dailySnap.data() : {};
        setTodaySalesData(dailyData);
    });

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch all master inventory items once
            const inventorySnapshot = await getDocs(collection(db, 'inventory'));
            const masterInventory = new Map<string, any>();
            inventorySnapshot.forEach(doc => {
                masterInventory.set(doc.id, { id: doc.id, ...doc.data() });
            });

            // Fetch yesterday's data for both stock and sales
            const yesterdayDocRef = doc(db, 'dailyInventory', yesterdayDateStr);
            const yesterdayDocSnap = await getDoc(yesterdayDocRef);
            const yesterdayData = yesterdayDocSnap.exists() ? yesterdayDocSnap.data() : {};
            setYesterdaySalesData(yesterdayData); // Set yesterday's sales data

            // Fetch today's data once for initial state
            const todayDocSnap = await getDoc(dailyDocRef);
            const todayData = todayDocSnap.exists() ? todayDocSnap.data() : {};

            const items: InventoryItem[] = [];

            masterInventory.forEach((masterItem) => {
                const id = masterItem.id;
                const dailyItem = todayData[id];
                // Use the master item's prevStock as the source of truth for opening stock
                const prevStock = masterItem.prevStock ?? 0;

                items.push({
                    ...masterItem,
                    prevStock: Number(prevStock),
                    added: Number(dailyItem?.added ?? 0),
                    sales: Number(dailyItem?.sales ?? 0),
                });
            });
            
            setInventory(items);

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    fetchDashboardData();

    // Cleanup the listener when the component unmounts
    return () => unsubscribeDaily();
  }, [formatDate]);

  const processedInventory = useMemo(() => {
    return inventory.map(item => {
      // Recalculate opening and closing based on potentially updated daily sales data
      const dailyItem = todaySalesData[item.id];
      const added = Number(dailyItem?.added ?? item.added ?? 0);
      const sales = Number(dailyItem?.sales ?? item.sales ?? 0);
      
      const opening = Number(item.prevStock ?? 0) + added;
      const closing = opening - sales;
      return {
        ...item,
        added,
        sales,
        opening,
        closing,
      };
    });
  }, [inventory, todaySalesData]);

  const calculateTotalSales = (salesData: any, inventoryMap: InventoryItem[]) => {
    let total = 0;
    for (const key in salesData) {
        if (Object.prototype.hasOwnProperty.call(salesData, key)) {
            const item = salesData[key];
            const masterItem = inventoryMap.find(inv => inv.id === key);
            const price = Number(item.price ?? masterItem?.price ?? 0);
            if (item.sales && price) {
                 total += Number(item.sales) * price;
            }
        }
    }
    return total;
  };

  const todaysSales = useMemo(() => {
    return calculateTotalSales(todaySalesData, inventory);
  }, [todaySalesData, inventory]);
  
  const yesterdaysSales = useMemo(() => {
    return calculateTotalSales(yesterdaySalesData, inventory)
  }, [yesterdaySalesData, inventory]);

  const totalOpeningStock = useMemo(() => {
    return processedInventory.reduce((sum, item) => sum + Number(item.opening || 0), 0);
  }, [processedInventory]);
  
  const { lowStockItems, outOfStockItems } = useMemo(() => {
    const lowStock: InventoryItem[] = [];
    const outOfStock: InventoryItem[] = [];

    processedInventory.forEach(item => {
        const closingStock = item.closing ?? 0;
        const stockAtDayStart = item.prevStock ?? 0;
        const addedToday = (item.added ?? 0) > 0;

        const wasJustRestocked = stockAtDayStart === 0 && addedToday;

        if (wasJustRestocked) {
            return; 
        }

        if (closingStock === 0 && stockAtDayStart > 0) { // Only alert if it was in stock at start of day
            outOfStock.push(item);
        } else if (closingStock > 0 && closingStock < 10) {
            lowStock.push(item);
        }
    });
    
    return { lowStockItems: lowStock, outOfStockItems: outOfStock };
  }, [processedInventory]);

  const totalAlerts = lowStockItems.length + outOfStockItems.length;

  if (loading) {
      return null;
  }

  return (
    <main className="flex-1 p-4 md:p-8">
       <LowStockDialog 
        isOpen={isLowStockDialogOpen}
        onOpenChange={setIsLowStockDialogOpen}
        lowStockItems={lowStockItems}
        outOfStockItems={outOfStockItems}
       />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {user?.displayName || 'User'}!</h1>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-8">
        <Link href="/dashboard/inventory" className="block hover:shadow-lg transition-shadow rounded-lg">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Stock</CardTitle>
                <PackageCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOpeningStock} Units</div>
                <p className="text-xs text-muted-foreground">
                  Today's opening stock across all items
                </p>
              </CardContent>
            </Card>
        </Link>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center">
                <IndianRupee className="h-6 w-6 mr-1" />
                {todaysSales.toLocaleString('en-IN')}
            </div>
             <p className="text-xs text-muted-foreground">
              Total sales recorded today
            </p>
          </CardContent>
        </Card>
        <Link href={`/dashboard/reports?from=${yesterdayString}&to=${yesterdayString}`} className="block hover:shadow-lg transition-shadow rounded-lg">
            <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Yesterday's Sales</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold flex items-center">
                    <IndianRupee className="h-6 w-6 mr-1" />
                    {yesterdaysSales.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-muted-foreground">
                Total sales recorded yesterday
                </p>
            </CardContent>
            </Card>
        </Link>
        <Card className={totalAlerts > 0 ? "bg-destructive/10 border-destructive/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${totalAlerts > 0 ? 'text-destructive': ''}`}>Stock Alerts</CardTitle>
            <TriangleAlert className={`h-4 w-4 ${totalAlerts > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalAlerts > 0 ? 'text-destructive' : ''}`}>{totalAlerts} Items</div>
            <div className="mt-2 text-xs space-y-1">
                {lowStockItems.length > 0 && (
                    <div className="flex justify-between">
                        <span>Low Stock</span>
                        <span className="font-semibold text-destructive">{lowStockItems.length} items</span>
                    </div>
                )}
                 {outOfStockItems.length > 0 && (
                    <div className="flex justify-between">
                        <span>Out of Stock</span>
                        <span className="font-semibold text-destructive">{outOfStockItems.length} items</span>
                    </div>
                )}
                {totalAlerts === 0 && (
                    <p className="text-xs text-muted-foreground">No stock alerts.</p>
                )}
            </div>
            {totalAlerts > 0 && 
                <Button variant="destructive" size="sm" className="w-full mt-4" onClick={() => setIsLowStockDialogOpen(true)}>
                    View All Alerts
                </Button>
            }
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4">Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((category) => {
            const image = PlaceHolderImages.find(p => p.id === category.imageId);
            return (
              <Card key={category.name} className="overflow-hidden hover:shadow-lg transition-shadow">
               <Link href="/dashboard/inventory">
                <CardContent className="p-0">
                  <div className="relative aspect-square w-full">
                    {image && (
                      <Image
                        src={image.imageUrl}
                        alt={category.name}
                        data-ai-hint={image.imageHint}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-center font-semibold">{category.name}</h3>
                  </div>
                </CardContent>
                </Link>
              </Card>
            )
          })}
        </div>
      </div>
    </main>
  );
}

    