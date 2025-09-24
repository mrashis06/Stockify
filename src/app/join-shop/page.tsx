
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDocs, collection, query, where, updateDoc, writeBatch, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogOut } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

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
    const [isAdminSetup, setIsAdminSetup] = useState(false);
    
    // Determine if this is an admin's first setup
    useEffect(() => {
        if (user && user.role === 'admin' && !user.shopId) {
            setIsAdminSetup(true);
        }
    }, [user]);


    const handleJoinShop = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!shopCode) {
            toast({ title: "Error", description: "Please enter an invite code.", variant: "destructive" });
            return;
        }
        if (!user) {
            toast({ title: "Error", description: "You must be logged in to join a shop.", variant: "destructive" });
            return;
        }

        setLoading(true);

        try {
            const invitesRef = collection(db, "invites");
            const q = query(invitesRef, where("code", "==", shopCode), where("status", "==", "pending"));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({ title: "Invalid Code", description: "This invite code is not valid, has expired, or has already been used.", variant: "destructive" });
                setLoading(false);
                return;
            }
            
            const batch = writeBatch(db);

            // Mark invite as used
            const inviteDoc = querySnapshot.docs[0];
            const inviteData = inviteDoc.data();
            batch.update(inviteDoc.ref, { status: 'accepted', acceptedBy: user.uid, acceptedAt: serverTimestamp() });

            // Update user's doc with the shopId
            const userDocRef = doc(db, "users", user.uid);
            batch.update(userDocRef, { shopId: inviteData.shopId });

            await batch.commit();

            toast({ title: "Success!", description: "You have successfully joined the shop." });
            router.push('/dashboard');

        } catch (error) {
            console.error("Error joining shop: ", error);
            toast({ title: "Error", description: "An unexpected error occurred. Please try again.", variant: "destructive" });
            setLoading(false);
        }
    };
    
    const handleCreateShop = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || user.role !== 'admin') return;
        setLoading(true);
        
        try {
            const shopDocRef = doc(collection(db, "shops"));
            const userDocRef = doc(db, "users", user.uid);

            const batch = writeBatch(db);
            batch.set(shopDocRef, {
                ownerId: user.uid,
                createdAt: serverTimestamp()
            });
            batch.update(userDocRef, {
                shopId: shopDocRef.id
            });
            await batch.commit();
            
            toast({ title: "Shop Created!", description: "Your shop has been successfully created. You can now manage your staff." });
            router.push('/dashboard/staff');

        } catch (error) {
            console.error("Error creating shop: ", error);
            toast({ title: "Error", description: "Could not create your shop. Please try again.", variant: "destructive" });
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        router.push('/login');
        router.refresh();
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

    if (isAdminSetup) {
         return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
                <Card className="mx-auto w-full max-w-sm">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">Create Your Shop</CardTitle>
                        <CardDescription>
                            Welcome, Admin! Complete this one-time step to set up your shop and start managing your inventory and staff.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCreateShop} className="grid gap-4">
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create My Shop
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


    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <Card className="mx-auto w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Join a Shop</CardTitle>
                    <CardDescription>
                        Enter the single-use Invite Code provided by your admin.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleJoinShop} className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="shop-code">Invite Code</Label>
                            <Input
                                id="shop-code"
                                type="text"
                                placeholder="Enter code"
                                required
                                value={shopCode}
                                onChange={(e) => setShopCode(e.target.value.toUpperCase())}
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
