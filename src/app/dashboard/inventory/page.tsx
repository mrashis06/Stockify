"use client";

import React, { useState, useMemo } from 'react';
import { IndianRupee, Plus, Search, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"

type InventoryItem = {
    id: number;
    brand: string;
    size: string;
    price: number;
    prevStock: number;
    added: number;
    sales: number;
    category: string;
};

const initialInventoryData: InventoryItem[] = [
  { id: 1, brand: 'Antiquity Blue', size: '750ml', price: 2100, prevStock: 50, added: 0, sales: 0, category: 'Whiskey' },
  { id: 2, brand: 'Old Monk', size: '180ml', price: 190, prevStock: 30, added: 0, sales: 0, category: 'Rum' },
  { id: 3, brand: 'Red Label', size: '750ml', price: 2500, prevStock: 40, added: 0, sales: 0, category: 'Whiskey' },
  { id: 4, brand: 'Kingfisher', size: '650ml', price: 150, prevStock: 60, added: 0, sales: 0, category: 'Beer' },
];

export default function InventoryPage() {
    const [inventory, setInventory] = useState(initialInventoryData);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All Categories');

    const handleInputChange = (id: number, field: keyof InventoryItem, value: string) => {
        setInventory(
            inventory.map(item => {
                if (item.id === id) {
                    let processedValue: string | number = value;
                    if (field === 'price' || field === 'prevStock' || field === 'added' || field === 'sales') {
                        processedValue = value === '' ? 0 : parseFloat(value);
                        if (isNaN(processedValue as number)) {
                            processedValue = item[field]; // Keep old value if parse fails
                        }
                    }
                    return { ...item, [field]: processedValue };
                }
                return item;
            })
        );
    };

    const handleDeleteRow = (id: number) => {
        setInventory(inventory.filter(item => item.id !== id));
    };

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const matchesSearch = item.brand.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'All Categories' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [inventory, searchQuery, categoryFilter]);


  return (
    <main className="flex-1 p-4 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight mb-6">Daily Inventory</h1>
        <Card>
            <CardContent className="p-4 md:p-6">
                 <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                    <div className="relative w-full md:w-auto md:min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search brands..."
                            className="pl-10 w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                         />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-full md:w-[180px]">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All Categories">All Categories</SelectItem>
                                <SelectItem value="Whiskey">Whiskey</SelectItem>
                                <SelectItem value="Rum">Rum</SelectItem>
                                <SelectItem value="Beer">Beer</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" className="bg-green-600 hover:bg-green-700 text-white">
                            <Plus className="mr-2 h-4 w-4" /> Add Brand
                        </Button>
                        <Button variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Remove Brand
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Brand</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Prev. Stock</TableHead>
                            <TableHead>Added</TableHead>
                            <TableHead>Opening</TableHead>
                            <TableHead>Sales</TableHead>
                            <TableHead>Closing</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredInventory.map(item => {
                            const opening = item.prevStock + item.added;
                            const closing = opening - item.sales;
                            const isLowStock = closing < 10;

                            return (
                                <TableRow key={item.id} className={isLowStock ? 'bg-destructive/10 hover:bg-destructive/20' : ''}>
                                    <TableCell className="font-medium">{item.brand}</TableCell>
                                    <TableCell>
                                        <Input
                                            type="text"
                                            className="h-8 w-24 bg-card"
                                            value={item.size}
                                            onChange={(e) => handleInputChange(item.id, 'size', e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center">
                                            <IndianRupee className="h-4 w-4 mr-1 shrink-0" />
                                            <Input
                                                type="number"
                                                className="h-8 w-24 bg-card"
                                                value={item.price}
                                                onChange={(e) => handleInputChange(item.id, 'price', e.target.value)}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className="h-8 w-20 bg-card"
                                            value={item.prevStock}
                                            onChange={(e) => handleInputChange(item.id, 'prevStock', e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className="h-8 w-20 bg-card"
                                            value={item.added || ''}
                                            onChange={(e) => handleInputChange(item.id, 'added', e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell>{opening}</TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            className={`h-8 w-20 bg-card ${isLowStock && item.sales > 0 ? 'bg-destructive/50' : ''}`}
                                            value={item.sales || ''}
                                            onChange={(e) => handleInputChange(item.id, 'sales', e.target.value)}
                                        />
                                    </TableCell>
                                    <TableCell className={isLowStock ? 'text-destructive font-bold' : ''}>{closing}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRow(item.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex justify-end mt-6">
                    <Button size="lg" className="bg-green-600 hover:bg-green-700">Save Changes</Button>
                </div>
            </CardContent>
        </Card>
    </main>
  );
}
