
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
            
            let q;
            if (user.role === 'admin') {
                // Admin sees low-stock and other admin-targeted notifications
                 q = query(notificationsRef, where('target', '==', 'admin'), orderBy('createdAt', 'desc'), limit(50));
            } else {
                // Staff sees staff-broadcasts
                 q = query(notificationsRef, where('target', '==', 'staff'), orderBy('createdAt', 'desc'), limit(50));
            }

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const allNotifications: Notification[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    allNotifications.push({ 
                        id: doc.id, 
                        readBy: [], // Ensure readBy is always an array
                        ...data,
                     } as Notification);
                });

                setNotifications(allNotifications);
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
export const createStaffBroadcast = async (shopId: string, data: Omit<NotificationData, 'target' | 'title'> & { title?: string }) => {
     try {
        const notificationRef = collection(db, `shops/${shopId}/notifications`);
        
        await addDoc(notificationRef, {
            ...data,
            title: data.title || "Message from Admin",
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
