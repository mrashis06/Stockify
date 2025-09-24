
"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, UserPlus, KeyRound, Copy, Trash2, ShieldOff, Shield, ClipboardCopy } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';

type StaffMember = {
    id: string;
    name: string;
    email: string;
    status: 'active' | 'blocked';
}

type InviteCode = {
    id: string;
    code: string;
    status: 'pending' | 'accepted';
}

export default function StaffPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

    // Fetch staff list for the admin's shop
    useEffect(() => {
        if (user && user.shopId) {
            setLoading(true);
            const staffQuery = query(collection(db, "users"), where("shopId", "==", user.shopId), where("role", "==", "staff"));
            const invitesQuery = query(collection(db, "invites"), where("shopId", "==", user.shopId), where("status", "==", "pending"));

            const unsubscribeStaff = onSnapshot(staffQuery, (snapshot) => {
                const staff: StaffMember[] = [];
                snapshot.forEach(doc => {
                    staff.push({ id: doc.id, ...doc.data() } as StaffMember);
                });
                setStaffList(staff);
                if(loading) setLoading(false);
            });

            const unsubscribeInvites = onSnapshot(invitesQuery, (snapshot) => {
                const codes: InviteCode[] = [];
                snapshot.forEach(doc => {
                    codes.push({ id: doc.id, ...doc.data() } as InviteCode);
                });
                setInviteCodes(codes);
                 if(loading) setLoading(false);
            });

            return () => {
                unsubscribeStaff();
                unsubscribeInvites();
            };
        } else if (user) {
            setLoading(false);
        }
    }, [user]);

    const handleGenerateCode = async () => {
        if (!user || !user.shopId) {
            toast({ title: "Shop Not Found", description: "You must have a shop to generate invite codes.", variant: "destructive" });
            return;
        };
        setGenerating(true);
        try {
            const newCode = uuidv4().substring(0, 8).toUpperCase();
            await addDoc(collection(db, "invites"), {
                code: newCode,
                shopId: user.shopId,
                ownerId: user.uid,
                status: 'pending',
                createdAt: serverTimestamp(),
            });

            toast({ title: "Success", description: "New invite code generated." });
        } catch (error) {
            console.error("Error generating code:", error);
            toast({ title: "Error", description: "Failed to generate invite code.", variant: "destructive" });
        } finally {
            setGenerating(false);
        }
    };
    
    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        toast({ title: "Copied!", description: "Invite code copied to clipboard." });
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
    
    if (!user?.shopId) {
        return (
             <main className="flex-1 p-4 md:p-8">
                 <h1 className="text-2xl font-bold tracking-tight mb-6">Staff Management</h1>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary"/> Create Your Shop</CardTitle>
                        <CardDescription>To invite staff, you first need to create your shop to get a unique Shop ID.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <p className="text-sm text-muted-foreground">This is a one-time process. Once your shop is created, you can start generating invite codes for your staff.</p>
                       {/* This functionality is handled in the join-shop page for the admin, but we can provide a dummy button for now. */}
                        <Button className="mt-4" disabled>Create Shop (Handled on first setup)</Button>
                    </CardContent>
                 </Card>
            </main>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-8">
             <AlertDialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove {selectedStaff?.name} from your shop. They will lose all access. They can rejoin later if you provide a new code.
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
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary"/> Invite Staff</CardTitle>
                        <CardDescription>Generate a unique, single-use code to invite a new staff member.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleGenerateCode} disabled={generating} className="w-full">
                            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                            Generate New Invite Code
                        </Button>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ClipboardCopy className="h-5 w-5 text-primary"/> Pending Invite Codes</CardTitle>
                        <CardDescription>Share these codes with new staff. They are single-use.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {inviteCodes.length > 0 ? (
                           <div className="space-y-2">
                                {inviteCodes.map(invite => (
                                    <div key={invite.id} className="flex items-center justify-between gap-4 p-2 border rounded-lg">
                                        <span className="font-mono text-sm tracking-widest">{invite.code}</span>
                                        <Button variant="ghost" size="icon" onClick={() => handleCopyCode(invite.code)}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                           </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">No pending invites. Generate a new code to invite staff.</p>
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
