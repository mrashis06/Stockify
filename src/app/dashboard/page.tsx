
"use client";

import { IndianRupee, PackageCheck, TriangleAlert } from "lucide-react";
import Image from "next/image";
import Link from 'next/link';
import { useEffect, useState, useMemo } from "react";
import { doc, onSnapshot, collection, getDocs, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, subDays } from 'date-fns';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PlaceHolderImages } from "@/lib/placeholder-images";
import type { InventoryItem } from "@/hooks/use-inventory";


const categories = [
  { name: "Whiskey", imageId: "whiskey-bottle" },
  { name: "Rum", imageId: "rum-bottle" },
  { name: "Vodka", imageId: "vodka-bottle" },
  { name: "Beer", imageId: "beer-bottle" },
  { name: "Wine", imageId: "wine-bottle" },
  { name: "IML", imageId: "iml-bottle" },
];

export default function DashboardPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [todaySalesData, setTodaySalesData] = useState<any>({});
  const [yesterdaySalesData, setYesterdaySalesData] = useState<any>({});


  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const dailyDocRef = doc(db, 'dailyInventory', today);

    const unsubscribe = onSnapshot(dailyDocRef, async (dailySnap) => {
      try {
        const dailyData = dailySnap.exists() ? dailySnap.data() : {};
        setTodaySalesData(dailyData);
        
        const inventorySnapshot = await getDocs(collection(db, 'inventory'));
        const masterInventory = new Map<string, any>();
        inventorySnapshot.forEach(doc => {
            masterInventory.set(doc.id, { id: doc.id, ...doc.data() });
        });

        const yesterdayDocRef = doc(db, 'dailyInventory', yesterday);
        const yesterdayDocSnap = await getDoc(yesterdayDocRef);
        const yesterdayData = yesterdayDocSnap.exists() ? yesterdayDocSnap.data() : {};
        setYesterdaySalesData(yesterdayData);

        const items: InventoryItem[] = [];

        masterInventory.forEach((masterItem) => {
            const id = masterItem.id;
            const dailyItem = dailyData[id];
            
            const prevStock = yesterdayData[id]?.closing ?? masterItem.prevStock ?? 0;

            if (dailyItem) {
                items.push({ ...masterItem, ...dailyItem, prevStock });
            } else {
                items.push({
                    ...masterItem,
                    prevStock,
                    added: 0,
                    sales: 0,
                });
            }
        });
        
        setInventory(items);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const processedInventory = useMemo(() => {
    return inventory.map(item => {
      const opening = (item.prevStock ?? 0) + (item.added ?? 0);
      const closing = opening - (item.sales ?? 0);
      return {
        ...item,
        opening,
        closing,
      };
    });
  }, [inventory]);

  const calculateTotalSales = (salesData: any) => {
    let total = 0;
    for (const key in salesData) {
        if (Object.prototype.hasOwnProperty.call(salesData, key)) {
            const item = salesData[key];
            if (item.sales && item.price) {
                 total += item.sales * item.price;
            }
        }
    }
    return total;
  };

  const todaysSales = useMemo(() => calculateTotalSales(todaySalesData), [todaySalesData]);
  const yesterdaysSales = useMemo(() => calculateTotalSales(yesterdaySalesData), [yesterdaySalesData]);

  const totalStock = processedInventory.reduce((acc, item) => acc + (item.closing ?? 0), 0);
  const lowStockItems = processedInventory.filter(item => (item.closing ?? 0) < 10);

  if (loading) {
      return (
          <main className="flex-1 p-4 md:p-8">
              <h1 className="text-2xl font-bold tracking-tight mb-6">Dashboard</h1>
              <div>Loading dashboard data...</div>
          </main>
      )
  }

  return (
    <main className="flex-1 p-4 md:p-8">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Dashboard</h1>
      
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Stock</CardTitle>
            <PackageCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStock} Units</div>
            <p className="text-xs text-muted-foreground">
              Today's closing stock across all items
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yesterday's Sales</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
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
        <Card className={lowStockItems.length > 0 ? "bg-destructive/10 border-destructive/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${lowStockItems.length > 0 ? 'text-destructive': ''}`}>Low Stock Alerts</CardTitle>
            <TriangleAlert className={`h-4 w-4 ${lowStockItems.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockItems.length > 0 ? 'text-destructive' : ''}`}>{lowStockItems.length} Items</div>
            <div className="mt-2 text-xs">
                {lowStockItems.length > 0 ? lowStockItems.slice(0, 2).map(item => (
                    <div key={item.id} className="flex justify-between">
                        <span>{item.brand} ({item.size})</span>
                        <span className="font-semibold text-destructive">{item.closing} left</span>
                    </div>
                )) : (
                    <p className="text-xs text-muted-foreground">No items are low on stock.</p>
                )}
            </div>
            {lowStockItems.length > 0 && 
                <Link href="/dashboard/inventory" className="text-xs text-destructive/80 hover:underline mt-2 block text-right">
                    View all
                </Link>
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
