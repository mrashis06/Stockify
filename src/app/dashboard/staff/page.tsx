
"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, UserPlus, KeyRound, Copy, Trash2, ShieldOff, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type StaffMember = {
    id: string;
    name: string;
    email: string;
    status: 'active' | 'blocked';
}

export default function StaffPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [shopCode, setShopCode] = useState<string | null>(null);
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

    // Fetch or create Shop ID for the admin
    useEffect(() => {
        if (user && user.role === 'admin') {
            const fetchShop = async () => {
                setLoading(true);
                const q = query(collection(db, "shops"), where("ownerId", "==", user.uid));
                const querySnapshot = await getDoc(doc(db, "users", user.uid));
                const userData = querySnapshot.data();
                
                if (userData && userData.shopId) {
                     const shopDoc = await getDoc(doc(db, "shops", userData.shopId));
                     if(shopDoc.exists()) {
                         setShopCode(shopDoc.data().shopId);
                     }
                }
                setLoading(false);
            };
            fetchShop();
        }
    }, [user]);
    
    // Fetch staff list for the admin's shop
    useEffect(() => {
        if (user && user.shopId) {
            const q = query(collection(db, "users"), where("shopId", "==", user.shopId), where("role", "==", "staff"));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const staff: StaffMember[] = [];
                snapshot.forEach(doc => {
                    staff.push({ id: doc.id, ...doc.data() } as StaffMember);
                });
                setStaffList(staff);
            });
            return () => unsubscribe();
        }
    }, [user]);

    const handleGenerateCode = async () => {
        if (!user || user.role !== 'admin') return;
        setGenerating(true);
        try {
            const newCode = uuidv4().substring(0, 8).toUpperCase();
            const shopDocRef = doc(collection(db, "shops"));

            await setDoc(shopDocRef, {
                shopId: newCode,
                ownerId: user.uid,
            });

            // Also update the admin's user doc with their own shopId
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, { shopId: shopDocRef.id });

            setShopCode(newCode);
            toast({ title: "Success", description: "New shop code generated." });
        } catch (error) {
            console.error("Error generating code:", error);
            toast({ title: "Error", description: "Failed to generate shop code.", variant: "destructive" });
        } finally {
            setGenerating(false);
        }
    };
    
    const handleCopyCode = () => {
        if (!shopCode) return;
        navigator.clipboard.writeText(shopCode);
        toast({ title: "Copied!", description: "Shop code copied to clipboard." });
    };

    const handleToggleStatus = async (staff: StaffMember) => {
        const newStatus = staff.status === 'active' ? 'blocked' : 'active';
        try {
            const staffDocRef = doc(db, "users", staff.id);
            await updateDoc(staffDocRef, { status: newStatus });
            toast({ title: "Success", description: `${staff.name}'s status has been updated to ${newStatus}.` });
        } catch (error) {
            console.error("Error updating status:", error);
            toast({ title: "Error", description: "Failed to update staff status.", variant: "destructive" });
        }
    };

    const confirmRemoveStaff = (staff: StaffMember) => {
        setSelectedStaff(staff);
        setDeleteAlertOpen(true);
    };

    const handleRemoveStaff = async () => {
        if (!selectedStaff) return;
        try {
            // This will 'remove' the staff by detaching them from the shop
            const staffDocRef = doc(db, "users", selectedStaff.id);
            await updateDoc(staffDocRef, { shopId: null });

            toast({ title: "Success", description: `${selectedStaff.name} has been removed from the shop.` });
        } catch (error) {
            console.error("Error removing staff:", error);
            toast({ title: "Error", description: "Failed to remove staff.", variant: "destructive" });
        } finally {
            setDeleteAlertOpen(false);
            setSelectedStaff(null);
        }
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-8">
             <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove {selectedStaff?.name} from your shop. They will lose all access. They can rejoin later if you provide the code again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveStaff} className="bg-destructive hover:bg-destructive/90">
                            Remove Staff
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <h1 className="text-2xl font-bold tracking-tight mb-6">Staff Management</h1>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary"/> Your Shop Code</CardTitle>
                        <CardDescription>Share this code with your staff to let them join your shop.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {shopCode ? (
                            <div className="flex items-center justify-between gap-4 p-3 border-2 border-dashed rounded-lg">
                                <span className="text-2xl font-bold tracking-widest font-mono text-center w-full">{shopCode}</span>
                                <Button variant="ghost" size="icon" onClick={handleCopyCode}>
                                    <Copy className="h-5 w-5" />
                                </Button>
                            </div>
                        ) : (
                            <Button onClick={handleGenerateCode} disabled={generating} className="w-full">
                                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                                Generate Shop Code
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
            
             <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Staff Members</CardTitle>
                    <CardDescription>A list of all staff members in your shop.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {staffList.length > 0 ? (
                                staffList.map(staff => (
                                    <TableRow key={staff.id}>
                                        <TableCell className="font-medium">{staff.name}</TableCell>
                                        <TableCell>{staff.email}</TableCell>
                                        <TableCell>
                                            <Badge variant={staff.status === 'active' ? 'default' : 'destructive'}>
                                                {staff.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(staff)}>
                                                {staff.status === 'active' ? <ShieldOff className="mr-2 h-4 w-4" /> : <Shield className="mr-2 h-4 w-4" />}
                                                {staff.status === 'active' ? 'Block' : 'Unblock'}
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => confirmRemoveStaff(staff)}>
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Remove
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No staff have joined your shop yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </main>
    );
}

