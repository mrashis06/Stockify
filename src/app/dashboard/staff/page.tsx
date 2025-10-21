
"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, deleteDoc, Timestamp, writeBatch, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useDateFormat } from '@/hooks/use-date-format';
import { Loader2, UserPlus, KeyRound, Copy, Trash2, ShieldOff, Shield, XCircle, ChevronDown, ChevronUp, Phone, Cake, FileText, User, Send } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { differenceInDays, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createStaffBroadcast, deleteStaffBroadcast, Notification } from '@/hooks/use-notifications';
import { Separator } from '@/components/ui/separator';


type StaffMember = {
    id: string;
    name: string;
    email: string;
    phone: string;
    dob: string;
    aadhaar: string;
    pan: string;
    status: 'active' | 'blocked';
}

type InviteCode = {
    id: string;
    code: string;
    status: 'pending' | 'accepted';
    createdAt: Timestamp;
}

const broadcastSchema = z.object({
  message: z.string().min(1, 'Message is required').max(500, 'Message is too long'),
});

type BroadcastFormValues = z.infer<typeof broadcastSchema>;

const CODE_EXPIRATION_DAYS = 7;

export default function StaffPage() {
    const { user, updateUser } = useAuth();
    const { toast } = useToast();
    const { formatDate } = useDateFormat();
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
    const [recentBroadcasts, setRecentBroadcasts] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [isDeleteCodeAlertOpen, setDeleteCodeAlertOpen] = useState(false);
    const [selectedCode, setSelectedCode] = useState<InviteCode | null>(null);
    const [lastGeneratedCode, setLastGeneratedCode] = useState<string | null>(null);
    const [isRemoveStaffAlertOpen, setIsRemoveStaffAlertOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [isDeleteBroadcastAlertOpen, setIsDeleteBroadcastAlertOpen] = useState(false);
    const [selectedBroadcast, setSelectedBroadcast] = useState<Notification | null>(null);

    const broadcastForm = useForm<BroadcastFormValues>({
        resolver: zodResolver(broadcastSchema),
        defaultValues: { message: '' },
    });

    useEffect(() => {
        if (user && user.shopId) {
            setLoading(true);
            const staffQuery = query(collection(db, "users"), where("shopId", "==", user.shopId), where("role", "==", "staff"));
            const invitesQuery = query(collection(db, "invites"), where("shopId", "==", user.shopId), where("status", "==", "pending"));
            const broadcastsQuery = query(collection(db, `shops/${user.shopId}/notifications`), orderBy('createdAt', 'desc'), limit(5));


            const unsubscribeStaff = onSnapshot(staffQuery, (snapshot) => {
                const staff: StaffMember[] = [];
                snapshot.forEach(doc => {
                    staff.push({ id: doc.id, ...doc.data() } as StaffMember);
                });
                setStaffList(staff);
                setLoading(false);
            }, (error) => {
                console.error("Staff listener error: ", error);
                setLoading(false);
            });

            const unsubscribeInvites = onSnapshot(invitesQuery, (snapshot) => {
                const codes: InviteCode[] = [];
                snapshot.forEach(doc => {
                    codes.push({ id: doc.id, ...doc.data() } as InviteCode);
                });
                setInviteCodes(codes);
            }, (error) => {
                console.error("Invites listener error: ", error);
            });
            
             const unsubscribeBroadcasts = onSnapshot(broadcastsQuery, (snapshot) => {
                const broadcasts: Notification[] = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
                    .filter(n => n.type === 'staff-broadcast');
                setRecentBroadcasts(broadcasts);
            });

            return () => {
                unsubscribeStaff();
                unsubscribeInvites();
                unsubscribeBroadcasts();
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
            const newCode = `${uuidv4().substring(0, 4)}-${uuidv4().substring(0, 4)}-${uuidv4().substring(0, 4)}`.toUpperCase();
            await addDoc(collection(db, "invites"), {
                code: newCode,
                shopId: user.shopId,
                ownerId: user.uid,
                status: 'pending',
                createdAt: serverTimestamp(),
            });

            setLastGeneratedCode(newCode);
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
            await updateUser(staff.id, { status: newStatus });
            toast({ title: "Success", description: `${staff.name}'s status has been updated to ${newStatus}.` });
        } catch (error) {
            console.error("Error updating status:", error);
            toast({ title: "Error", description: "Failed to update staff status.", variant: "destructive" });
        }
    };

    const confirmDeleteCode = (code: InviteCode) => {
        setSelectedCode(code);
        setDeleteCodeAlertOpen(true);
    };

    const handleDeleteCode = async () => {
        if (!selectedCode) return;
        try {
            await deleteDoc(doc(db, "invites", selectedCode.id));
            toast({ title: "Success", description: "Invite code has been deleted." });
        } catch (error) {
            console.error("Error deleting invite code:", error);
            toast({ title: "Error", description: "Failed to delete invite code.", variant: "destructive" });
        } finally {
            setDeleteCodeAlertOpen(false);
            setSelectedCode(null);
        }
    };
    
    const confirmRemoveStaff = (staff: StaffMember) => {
        setSelectedStaff(staff);
        setIsRemoveStaffAlertOpen(true);
    };

    const handleRemoveStaff = async () => {
        if (!selectedStaff || !updateUser) return;
        try {
            await updateUser(selectedStaff.id, { status: 'blocked', shopId: null });
            toast({ title: "Success", description: `${selectedStaff.name} has been removed from the shop.` });
        } catch(error) {
            console.error("Error removing staff:", error);
            toast({ title: "Error", description: "Failed to remove staff member.", variant: "destructive" });
        } finally {
            setIsRemoveStaffAlertOpen(false);
            setSelectedStaff(null);
        }
    }
    
    const getCodeExpiration = (createdAt: Timestamp) => {
        if (!createdAt) return { text: 'N/A', isExpired: false, badgeColor: 'bg-gray-400' };
        
        const creationDate = createdAt.toDate();
        const daysSinceCreation = differenceInDays(new Date(), creationDate);
        const daysLeft = CODE_EXPIRATION_DAYS - daysSinceCreation;

        if (daysLeft <= 0) return { text: 'Expired', isExpired: true, badgeColor: 'bg-red-500' };
        if (daysLeft <= 2) return { text: `Expires in ${daysLeft} days`, isExpired: false, badgeColor: 'bg-yellow-500 text-yellow-900' };
        return { text: `Expires in ${daysLeft} days`, isExpired: false, badgeColor: 'bg-yellow-300 text-yellow-800' };
    };
    
    const toggleRowExpansion = (staffId: string) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(staffId)) {
            newSet.delete(staffId);
        } else {
            newSet.add(staffId);
        }
        setExpandedRows(newSet);
    };

    const handleBroadcast = async (data: BroadcastFormValues) => {
        if (!user || !user.shopId) return;

        try {
            await createStaffBroadcast(user.shopId, {
                description: data.message,
                type: 'staff-broadcast',
                author: user.name || 'Admin',
            });
            toast({ title: 'Broadcast Sent', description: 'Your message has been sent to all staff members.' });
            broadcastForm.reset();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to send broadcast.', variant: 'destructive' });
            console.error("Broadcast error:", error);
        }
    };
    
    const confirmDeleteBroadcast = (broadcast: Notification) => {
        setSelectedBroadcast(broadcast);
        setIsDeleteBroadcastAlertOpen(true);
    };

    const handleDeleteBroadcast = async () => {
        if (!user || !user.shopId || !selectedBroadcast) return;
        try {
            await deleteStaffBroadcast(user.shopId, selectedBroadcast.id);
            toast({ title: 'Success', description: 'Broadcast message deleted.' });
        } catch(error) {
            toast({ title: 'Error', description: 'Failed to delete message.', variant: 'destructive' });
        } finally {
            setIsDeleteBroadcastAlertOpen(false);
            setSelectedBroadcast(null);
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
                 <h1 className="text-3xl font-bold tracking-tight mb-6">Staff Management</h1>
                 <p className="text-muted-foreground font-bold mb-6">{formatDate(new Date(), 'dd/MM/yyyy')}</p>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl"><KeyRound className="h-5 w-5 text-primary"/> Create Your Shop</CardTitle>
                        <CardDescription>To invite staff, you first need to create your shop to get a unique Shop ID.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <p className="text-sm text-muted-foreground">This is a one-time process. Once your shop is created, you can start generating invite codes for your staff.</p>
                        <Button className="mt-4" disabled>Create Shop (Handled on first setup)</Button>
                    </CardContent>
                 </Card>
            </main>
        )
    }

    return (
        <main className="flex-1 p-4 md:p-8">
            <AlertDialog open={isDeleteCodeAlertOpen} onOpenChange={setDeleteCodeAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Invite Code?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the code <span className="font-mono bg-muted p-1 rounded-sm">{selectedCode?.code}</span>? This action is permanent and the code will no longer be usable.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteCode} className="bg-destructive hover:bg-destructive/90">
                            Delete Code
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={isRemoveStaffAlertOpen} onOpenChange={setIsRemoveStaffAlertOpen}>
                 <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove {selectedStaff?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                           This will block the staff member's access and remove them from your shop. They will need to contact you to be re-instated. Are you sure?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveStaff} className="bg-destructive hover:bg-destructive/90">
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={isDeleteBroadcastAlertOpen} onOpenChange={setIsDeleteBroadcastAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Broadcast Message?</AlertDialogTitle>
                        <AlertDialogDescription>
                           This will permanently delete the message for all staff. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteBroadcast} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
                <p className="text-muted-foreground font-bold">{formatDate(new Date(), 'dd/MM/yyyy')}</p>
            </div>
            <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
                <div className="space-y-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">Invite Staff</CardTitle>
                            <CardDescription>Generate a unique invite code for new staff members to join your team.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                            <Button onClick={handleGenerateCode} disabled={generating} className="bg-green-600 hover:bg-green-700 text-white shrink-0">
                                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                                Generate New Invite Code
                            </Button>
                            {lastGeneratedCode && (
                                <div className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-muted/50 w-full">
                                    <span className="font-mono text-sm tracking-widest">{lastGeneratedCode}</span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyCode(lastGeneratedCode)}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">Pending Invite Codes</CardTitle>
                            <CardDescription>View and manage unused invite codes. Codes expire after 7 days.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {inviteCodes.length > 0 ? (
                                <div className="space-y-2">
                                    {inviteCodes.map(invite => {
                                        const expiration = getCodeExpiration(invite.createdAt);
                                        return (
                                        <div key={invite.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 border rounded-lg bg-muted/30">
                                            <span className="font-mono text-sm tracking-wider">{invite.code}</span>
                                            <div className="flex items-center gap-2 self-end">
                                                {!expiration.isExpired && <Badge className={`text-xs font-medium ${expiration.badgeColor}`}>{expiration.text}</Badge>}
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopyCode(invite.code)}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => confirmDeleteCode(invite)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-24 border-2 border-dashed rounded-lg">
                                    <p className="text-sm text-muted-foreground text-center">No pending invites.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                 <Card>
                    <CardHeader>
                        <CardTitle className="text-xl">Broadcast to Staff</CardTitle>
                        <CardDescription>Send a notification to all active staff members.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...broadcastForm}>
                            <form onSubmit={broadcastForm.handleSubmit(handleBroadcast)} className="space-y-4">
                                <FormField control={broadcastForm.control} name="message" render={({ field }) => (
                                     <FormItem>
                                        <FormLabel>Message</FormLabel>
                                        <FormControl><Textarea placeholder="Your message here..." {...field} rows={4} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>
                                <Button type="submit" disabled={broadcastForm.formState.isSubmitting} className="w-full">
                                    {broadcastForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                                    Send Message
                                </Button>
                            </form>
                        </Form>
                         <Separator className="my-6" />
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground">Recent Broadcasts</h3>
                            {recentBroadcasts.length > 0 ? (
                                <div className="space-y-3">
                                {recentBroadcasts.map(b => (
                                    <div key={b.id} className="flex justify-between items-start gap-4 p-3 border rounded-lg">
                                        <div>
                                            <p className="text-sm">{b.description}</p>
                                            {b.createdAt && (
                                                <p className="text-xs text-muted-foreground mt-1">{formatDate(b.createdAt.toDate(), 'dd-MM-yyyy hh:mm a')}</p>
                                            )}
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => confirmDeleteBroadcast(b)}>
                                            <Trash2 className="h-4 w-4 text-destructive/80" />
                                        </Button>
                                    </div>
                                ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No recent broadcasts.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            <div className="mt-8">
                <h2 className="text-xl font-bold tracking-tight mb-4">Staff Members</h2>
                <Card>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="hidden md:table-cell">Email</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {staffList.length > 0 ? (
                                    staffList.map(staff => (
                                    <React.Fragment key={staff.id}>
                                            <TableRow>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => toggleRowExpansion(staff.id)} className="h-8 w-8">
                                                        {expandedRows.has(staff.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="font-medium">{staff.name}</TableCell>
                                                <TableCell className="hidden md:table-cell">{staff.email}</TableCell>
                                                <TableCell>
                                                    <Badge variant={staff.status === 'active' ? 'default' : 'destructive'} className={staff.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                                        {staff.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right space-x-2 md:space-x-4">
                                                    <Button variant="link" size="sm" className="p-0 h-auto font-medium text-blue-600" onClick={() => handleToggleStatus(staff)}>
                                                        {staff.status === 'active' ? 'Block' : 'Unblock'}
                                                    </Button>
                                                    <Button variant="link" size="sm" className="p-0 h-auto font-medium text-destructive" onClick={() => confirmRemoveStaff(staff)}>
                                                        Remove
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                            {expandedRows.has(staff.id) && (
                                                <TableRow key={`${staff.id}-details`} className="bg-muted/50 hover:bg-muted/50">
                                                    <TableCell colSpan={5} className="p-4">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <div className="flex items-center gap-2 text-sm md:hidden">
                                                                <strong>Email:</strong>
                                                                <span className="truncate">{staff.email}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                                                <strong>Phone:</strong>
                                                                <span>{staff.phone || 'N/A'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <Cake className="h-4 w-4 text-muted-foreground" />
                                                                <strong>DOB:</strong>
                                                                <span>{staff.dob ? formatDate(staff.dob) : 'N/A'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <User className="h-4 w-4 text-muted-foreground" />
                                                                <strong>Aadhaar:</strong>
                                                                <span>{staff.aadhaar || 'N-A'}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <FileText className="h-4 w-4 text-muted-foreground" />
                                                                <strong>PAN:</strong>
                                                                <span>{staff.pan || 'N-A'}</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No staff have joined your shop yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </main>
    );
}
