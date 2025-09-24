
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';


export default function JoinShopPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [shopCode, setShopCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleJoinShop = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shopCode) {
            toast({ title: "Error", description: "Please enter a shop code.", variant: "destructive" });
            return;
        }
        if (!user) {
            toast({ title: "Error", description: "You must be logged in to join a shop.", variant: "destructive" });
            return;
        }

        setLoading(true);

        try {
            const shopsRef = collection(db, "shops");
            const q = query(shopsRef, where("shopId", "==", shopCode));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ title: "Invalid Code", description: "The shop code you entered is not valid. Please check and try again.", variant: "destructive" });
                setLoading(false);
                return;
            }

            // Assuming shop codes are unique, so we take the first one
            const shopDoc = querySnapshot.docs[0];
            const shopId = shopDoc.id;

            // Update the user's document with the shopId
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                shopId: shopId,
            });

            toast({ title: "Success!", description: "You have successfully joined the shop." });
            router.push('/dashboard');

        } catch (error) {
            console.error("Error joining shop: ", error);
            toast({ title: "Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
            setLoading(false);
        }
    };
    
    const handleLogout = async () => {
        await signOut(auth);
        router.push('/login');
    };

    if (authLoading) {
        return (
            <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
                <div>Loading...</div>
            </div>
        );
    }
    
    if (!authLoading && !user) {
        router.push('/login');
        return null;
    }


    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <Card className="mx-auto w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Join a Shop</CardTitle>
                    <CardDescription>
                        Enter the Shop Code provided by your admin to get access.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleJoinShop} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="shop-code">Shop Code</Label>
                            <Input
                                id="shop-code"
                                type="text"
                                placeholder="Enter code"
                                required
                                value={shopCode}
                                onChange={(e) => setShopCode(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Join Shop
                        </Button>
                    </form>
                    <div className="mt-4 border-t pt-4">
                        <Button variant="outline" className="w-full" onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Log Out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

