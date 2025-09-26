
"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, addDoc, serverTimestamp, doc, updateDoc, getDoc, writeBatch, arrayUnion, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './use-auth';
import { v4 as uuidv4 } from 'uuid';

export type Notification = {
    id: string;
    title: string;
    description: string;
    readBy: string[]; // Array of user UIDs who have read it
    createdAt: any; // Firestore Timestamp
    type: 'low-stock' | 'info' | 'staff-request' | 'staff-broadcast';
    link?: string;
    target?: 'admin' | 'staff'; // Specify who the notification is for
    author?: string; // Who sent the notification
    productId?: string; // To link notification to a specific product
};

export type NotificationData = Omit<Notification, 'id' | 'createdAt' | 'readBy'>;

export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && user.shopId) {
            setLoading(true);
            const notificationsRef = collection(db, `shops/${user.shopId}/notifications`);
            
            // Simplified query to avoid composite index requirement.
            // We will filter by target on the client-side.
            const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const allNotifications: Notification[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    allNotifications.push({ 
                        id: doc.id, 
                        readBy: data.readBy || [], // Ensure readBy is always an array
                        ...data,
                     } as Notification);
                });

                // Perform client-side filtering based on user role
                const userRole = user.role;
                const filteredNotifications = allNotifications.filter(n => {
                    if (userRole === 'admin') {
                        // Admin sees low-stock, info, and other admin-targeted notifications
                        return n.target === 'admin';
                    } else if (userRole === 'staff') {
                        // Staff sees staff-broadcasts
                        return n.target === 'staff';
                    }
                    return false; // Should not happen for logged-in users
                });

                setNotifications(filteredNotifications);
                setLoading(false);
            }, (error) => {
                console.error("Error fetching notifications:", error);
                setLoading(false);
            });

            return () => unsubscribe();
        } else {
            setNotifications([]);
            setLoading(false);
        }
    }, [user]);

    const markAsRead = async (notificationId: string) => {
        if (user && user.shopId && user.uid) {
            const notifRef = doc(db, `shops/${user.shopId}/notifications`, notificationId);
            try {
                // Add the current user's UID to the 'readBy' array.
                // arrayUnion prevents duplicates.
                await updateDoc(notifRef, { 
                    readBy: arrayUnion(user.uid)
                });
            } catch (error) {
                console.error("Error marking notification as read:", error);
            }
        }
    };

    return { notifications, loading, markAsRead };
}

// Function for creating admin-targeted notifications
export const createAdminNotification = async (shopId: string, data: Omit<NotificationData, 'target'>) => {
    try {
        const notificationRef = collection(db, `shops/${shopId}/notifications`);
        
        // If it's a low-stock alert, check if one already exists for this product
        if (data.type === 'low-stock' && data.productId) {
            const q = query(notificationRef, where("type", "==", "low-stock"), where("productId", "==", data.productId));
            const existing = await getDocs(q);
            if (!existing.empty) {
                // An alert for this product already exists, do not create a new one.
                return;
            }
        }

        await addDoc(notificationRef, {
            ...data,
            target: 'admin',
            readBy: [],
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to create admin notification:", error);
    }
};

// Function for creating staff-targeted broadcast notifications
export const createStaffBroadcast = async (shopId: string, data: Omit<NotificationData, 'target' | 'title'>) => {
     try {
        const notificationRef = collection(db, `shops/${shopId}/notifications`);
        
        await addDoc(notificationRef, {
            ...data,
            title: "Message from Admin",
            target: 'staff',
            readBy: [],
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to create staff broadcast:", error);
    }
};

export const deleteStaffBroadcast = async (shopId: string, notificationId: string) => {
    try {
        const notifRef = doc(db, `shops/${shopId}/notifications`, notificationId);
        await deleteDoc(notifRef);
    } catch (error) {
        console.error("Failed to delete staff broadcast:", error);
        throw error;
    }
};
