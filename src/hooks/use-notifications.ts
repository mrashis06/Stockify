
"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, addDoc, serverTimestamp, doc, updateDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './use-auth';
import { v4 as uuidv4 } from 'uuid';

export type Notification = {
    id: string;
    title: string;
    description: string;
    read: boolean;
    createdAt: any; // Firestore Timestamp
    type: 'low-stock' | 'info' | 'staff-request' | 'staff-broadcast';
    link?: string;
    target?: 'admin' | 'staff'; // Specify who the notification is for
    author?: string; // Who sent the notification
};

export type NotificationData = Omit<Notification, 'id' | 'createdAt' | 'read'>;

export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && user.shopId) {
            setLoading(true);
            const notificationsRef = collection(db, `shops/${user.shopId}/notifications`);
            
            // Query for all recent notifications and filter client-side
            const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const allNotifications: Notification[] = [];
                snapshot.forEach(doc => {
                    allNotifications.push({ id: doc.id, ...doc.data() } as Notification);
                });

                // Filter based on user role
                const filteredNotifications = allNotifications.filter(n => {
                    if (user.role === 'admin') {
                        return n.target === 'admin';
                    }
                    return n.target === 'staff';
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
        if (user && user.shopId) {
            const notifRef = doc(db, `shops/${user.shopId}/notifications`, notificationId);
            try {
                // To mark a broadcast as read for a specific user, we'd need a more complex system
                // (e.g., a 'readBy' array on the notification). For simplicity, we'll mark the main doc.
                // This means if one staff reads it, it appears read for all. This is a reasonable MVP tradeoff.
                const notification = notifications.find(n => n.id === notificationId);
                if(notification && notification.type === 'staff-broadcast' && user.role === 'staff') {
                    // Don't mark broadcasts as globally read, just hide it client-side for this user.
                    // A proper implementation would track read status per user.
                    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
                    return;
                }
                
                await updateDoc(notifRef, { read: true });

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
            read: false,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to create admin notification:", error);
    }
};

// Function for creating staff-targeted broadcast notifications
export const createStaffBroadcast = async (shopId: string, data: Omit<NotificationData, 'target'> & { title?: string }) => {
     try {
        const notificationRef = collection(db, `shops/${shopId}/notifications`);
        
        await addDoc(notificationRef, {
            ...data,
            title: data.title || "Message from Admin",
            target: 'staff',
            read: false,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to create staff broadcast:", error);
    }
};
