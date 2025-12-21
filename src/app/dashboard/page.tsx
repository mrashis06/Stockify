
"use client";

import { IndianRupee, PackageCheck, TriangleAlert } from "lucide-react";
import Image from "next/image";
import Link from 'next/link';
import { useEffect, useMemo, useState } from "react";
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, getDocs, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subDays, format, isSameDay } from 'date-fns';
import { useDateFormat } from "@/hooks/use-date-format";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useInventory, type InventoryItem } from "@/hooks/use-inventory";
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


export default function DashboardPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
  const { user, shopId } = useAuth();
  const router = useRouter();
  
  const { inventory, onBarInventory, loading, totalOnBarSales, initListeners } = useInventory();
  
  const [yesterdaySalesData, setYesterdaySalesData] = useState<any>({});
  const [isYesterdayLoading, setIsYesterdayLoading] = useState(true);
  const { formatDate } = useDateFormat();
  const [isLowStockDialogOpen, setIsLowStockDialogOpen] = useState(false);
  
  usePageLoading(loading || isYesterdayLoading);
  const today = useMemo(() => new Date(), []);
  const yesterday = useMemo(() => subDays(new Date(), 1), []);
  const yesterdayString = useMemo(() => formatDate(yesterday, 'yyyy-MM-dd'), [yesterday, formatDate]);

  useEffect(() => {
    const unsub = initListeners(today);
    return () => unsub();
  }, [today, initListeners]);

  useEffect(() => {
    if (user?.role === 'staff') {
      router.replace('/dashboard/sales');
    }
  }, [user, router]);


  useEffect(() => {
    if (user?.role !== 'admin' || !user?.shopId) {
        setIsYesterdayLoading(false);
        return;
    };
    
    const yesterdayDateStr = formatDate(subDays(new Date(), 1), 'yyyy-MM-dd');
    
    const fetchYesterdayData = async () => {
        setIsYesterdayLoading(true);
        try {
            const yesterdayDocRef = doc(db, 'dailyInventory', yesterdayDateStr);
            const yesterdayDocSnap = await getDoc(yesterdayDocRef);
            setYesterdaySalesData(yesterdayDocSnap.exists() ? yesterdayDocSnap.data() : {});
        } catch (error) {
            console.error("Error fetching yesterday's data:", error);
        } finally {
            setIsYesterdayLoading(false);
        }
    };

    fetchYesterdayData();

  }, [user, formatDate]);
  
  const processedInventory = useMemo(() => {
        return inventory.map(item => {
            const added = Number(item.added || 0);
            const sales = Number(item.sales || 0);
            const prevStock = Number(item.prevStock || 0);

            const opening = prevStock + added;
            const closing = opening - sales;
            
            return {
                ...item,
                added,
                sales,
                prevStock,
                opening,
                closing,
            };
        });
    }, [inventory]);

  const activeInventory = useMemo(() => {
    return processedInventory.filter(item => {
        return (item.opening ?? 0) > 0 || (item.closing ?? 0) > 0 || (item.sales ?? 0) > 0;
    });
  }, [processedInventory]);

  const currentTotalStock = useMemo(() => {
    return activeInventory.reduce((sum, item) => {
        return sum + (item.closing ?? 0);
    }, 0);
  }, [activeInventory]);

  const todaysSales = useMemo(() => {
      const offCounterTotal = activeInventory.reduce((total, item) => total + (Number(item.sales) || 0) * (Number(item.price) || 0), 0);
      return offCounterTotal + totalOnBarSales;
  }, [activeInventory, totalOnBarSales]);

  
  const calculateTotalSales = (salesData: any) => {
    let total = 0;
    for (const key in salesData) {
        if (Object.prototype.hasOwnProperty.call(salesData, key)) {
            const itemLog = salesData[key];
            if (itemLog && itemLog.salesValue) {
                total += Number(itemLog.salesValue);
            } else if (itemLog && itemLog.sales > 0 && itemLog.price > 0) {
                 total += Number(itemLog.sales) * Number(itemLog.price);
            }
        }
    }
    return total;
  };

  const yesterdaysSales = useMemo(() => {
    return calculateTotalSales(yesterdaySalesData)
  }, [yesterdaySalesData]);

  const { lowStockItems, outOfStockItems } = useMemo(() => {
    const low: InventoryItem[] = [];
    const out: InventoryItem[] = [];
    const onBarMap = new Map(onBarInventory.map(item => [item.inventoryId, item]));

    inventory.forEach(item => {
      const processedItem = processedInventory.find(p => p.id === item.id);
      const shopStock = processedItem?.closing ?? 0;
      
      const godownStock = item.stockInGodown || 0;
      const onBarItem = onBarMap.get(item.id);
      const onBarStock = onBarItem?.remainingVolume || 0;

      const totalStock = shopStock + godownStock + onBarStock;

      if (totalStock <= 0) {
        out.push(item);
      } else if (shopStock > 0 && shopStock < 10) {
        if (processedItem) low.push(processedItem);
      }
    });
    
    return { lowStockItems: low, outOfStockItems: out };
  }, [inventory, processedInventory, onBarInventory]);


  useEffect(() => {
    if (shopId && !loading) {
        lowStockItems.forEach(item => {
            createSharedNotification(shopId, {
                title: 'Low Stock Alert',
                description: `${item.brand} (${item.size}) is low on stock. Remaining in shop: ${item.closing} units.`,
                type: 'low-stock',
                productId: item.id,
                link: '/dashboard/inventory'
            });
        });
        outOfStockItems.forEach(item => {
            createSharedNotification(shopId, {
                title: 'Out of Stock Alert',
                description: `${item.brand} (${item.size}) is now out of stock across all locations.`,
                type: 'low-stock',
                productId: item.id,
                link: '/dashboard/godown'
            });
        });
    }
  }, [lowStockItems, outOfStockItems, shopId, loading]);

  const totalAlerts = lowStockItems.length + outOfStockItems.length;

  if (loading || isYesterdayLoading || user?.role !== 'admin') {
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
        <div className="flex items-center gap-2">
            <p className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">{formatDate(new Date(), 'dd-MMM-yyyy, EEEE')}</p>
            <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-foreground/80">&bull;</span>
            <RealTimeClock />
        </div>
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
            <div className={`text-2xl font-bold ${totalAlerts > 0 ? 'text-destructive' : ''}`}>{lowStockItems.length + outOfStockItems.length} Items</div>
            <div className="mt-2 text-xs space-y-1">
                {lowStockItems.length > 0 && (
                    <div className="flex justify-between">
                        <span>Low Stock (Shop)</span>
                        <span className="font-semibold text-destructive">{lowStockItems.length} items</span>
                    </div>
                )}
                 {outOfStockItems.length > 0 && (
                    <div className="flex justify-between">
                        <span>Out of Stock (Global)</span>
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
               <Link href={`/dashboard/inventory?category=${encodeURIComponent(category.name)}`}>
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

    