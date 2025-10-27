
"use client";

import { IndianRupee, PackageCheck, TriangleAlert } from "lucide-react";
import Image from "next/image";
import Link from 'next/link';
import { useEffect, useState, useMemo } from "react";
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, getDocs, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subDays, format } from 'date-fns';
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
import { createSharedNotification } from "@/hooks/use-notifications";


const categories = [
  { name: "Whiskey", imageId: "whiskey-bottle" },
  { name: "Rum", imageId: "rum-bottle" },
  { name: "Vodka", imageId: "vodka-bottle" },
  { name: "Beer", imageId: "beer-bottle" },
  { name: "Wine", imageId: "wine-bottle" },
  { name: "IML", imageId: "iml-bottle" },
];

export default function DashboardPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
  const { user, shopId } = useAuth();
  const router = useRouter();
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
    if (user?.role === 'staff') {
      router.replace('/dashboard/sales');
    }
  }, [user, router]);


  useEffect(() => {
    if (user?.role !== 'admin' || !user?.shopId) return;

    const today = formatDate(new Date(), 'yyyy-MM-dd');
    const yesterdayDateStr = formatDate(subDays(new Date(), 1), 'yyyy-MM-dd');
    
    const fetchMasterAndDailyData = async () => {
        setLoading(true);
        try {
            // Fetch all master inventory items once
            const inventorySnapshot = await getDocs(collection(db, 'inventory'));
            const masterInventoryList: InventoryItem[] = [];
            inventorySnapshot.forEach(doc => {
                masterInventoryList.push({ id: doc.id, ...doc.data() } as InventoryItem);
            });
            setInventory(masterInventoryList);

            // Fetch yesterday's data ONCE for stable opening stock calculation
            const yesterdayDocRef = doc(db, 'dailyInventory', yesterdayDateStr);
            const yesterdayDocSnap = await getDoc(yesterdayDocRef);
            setYesterdaySalesData(yesterdayDocSnap.exists() ? yesterdayDocSnap.data() : {});

        } catch (error) {
            console.error("Error fetching initial dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    fetchMasterAndDailyData();

    // Listener for ONLY today's data to keep sales figures live.
    const dailyDocRef = doc(db, 'dailyInventory', today);
    const unsubscribeDaily = onSnapshot(dailyDocRef, (dailySnap) => {
        setTodaySalesData(dailySnap.exists() ? dailySnap.data() : {});
    }, (error) => {
        console.error("Error setting up daily data listener:", error);
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribeDaily();
  }, [user, formatDate]);

  const processedInventory = useMemo(() => {
    // This calculation now creates a stable opening stock for the day.
    return inventory.map(item => {
      const dailyItem = todaySalesData[item.id] || {};
      const yesterdayClosing = yesterdaySalesData[item.id]?.closing ?? item.prevStock ?? 0;
      
      const added = Number(dailyItem?.added ?? 0);
      const sales = Number(dailyItem?.sales ?? 0);
      const opening = yesterdayClosing + added;
      const closing = opening - sales;

      return {
        ...item,
        prevStock: yesterdayClosing, // This is the stable opening stock for today
        added,
        sales,
        opening,
        closing,
      };
    });
  }, [inventory, todaySalesData, yesterdaySalesData]);
  
  const currentTotalStock = useMemo(() => {
    return processedInventory.reduce((sum, item) => {
        return sum + (item.closing ?? 0);
    }, 0);
  }, [processedInventory]);

  const calculateTotalSales = (salesData: any, masterInventory: InventoryItem[]) => {
    let total = 0;
    const inventoryMap = new Map(masterInventory.map(item => [item.id, item]));

    for (const key in salesData) {
        if (Object.prototype.hasOwnProperty.call(salesData, key)) {
            const itemLog = salesData[key];
            
            if (itemLog && itemLog.salesValue) { // For On-Bar sales which store direct value
                total += Number(itemLog.salesValue);
            } else if (itemLog && itemLog.sales > 0) { // For Off-Counter sales from a snapshot
                 const masterItem = inventoryMap.get(key);
                 const price = itemLog.price || masterItem?.price || 0;
                 if (price > 0) {
                     total += Number(itemLog.sales) * Number(price);
                 }
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

  const { lowStockItems, outOfStockItems } = useMemo(() => {
    const low: InventoryItem[] = [];
    const out: InventoryItem[] = [];

    processedInventory.forEach(item => {
      const closingStock = item.closing ?? 0;
      
      // An item is out of stock if its closing stock is zero.
      if (closingStock <= 0) {
          out.push(item);
      }
      // Low stock: if it's not out of stock, but the quantity is low.
      else if (closingStock > 0 && closingStock < 10) {
          low.push(item);
      }
    });
    
    return { lowStockItems: low, outOfStockItems: out };
  }, [processedInventory]);

  useEffect(() => {
    if (shopId && !loading) {
        lowStockItems.forEach(item => {
            createSharedNotification(shopId, {
                title: 'Low Stock Alert',
                description: `${item.brand} (${item.size}) is low on stock. Remaining: ${item.closing} units.`,
                type: 'low-stock',
                productId: item.id,
                link: '/dashboard/inventory'
            });
        });
        outOfStockItems.forEach(item => {
            createSharedNotification(shopId, {
                title: 'Out of Stock Alert',
                description: `${item.brand} (${item.size}) is now out of stock.`,
                type: 'low-stock',
                productId: item.id,
                link: '/dashboard/inventory'
            });
        });
    }
  }, [lowStockItems, outOfStockItems, shopId, loading]);

  const totalAlerts = lowStockItems.length + outOfStockItems.length;

  if (loading || user?.role !== 'admin') {
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
        <p className="text-muted-foreground font-bold">{formatDate(new Date(), 'dd/MM/yyyy')}</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-8">
        <Link href="/dashboard/inventory" className="block hover:shadow-lg transition-shadow rounded-lg">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Live Stock</CardTitle>
                <PackageCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentTotalStock} Units</div>
                <p className="text-xs text-muted-foreground">
                  Current closing stock in the shop.
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
