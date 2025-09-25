
"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, addDoc, serverTimestamp, doc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './use-auth';
import { v4 as uuidv4 } from 'uuid';

export type Notification = {
    id: string;
    uid: string; // The user ID of the recipient (admin)
    title: string;
    description: string;
    read: boolean;
    createdAt: any; // Firestore Timestamp
    type: 'low-stock' | 'info' | 'staff-request';
    link?: string;
};

export type NotificationData = Omit<Notification, 'id' | 'uid' | 'createdAt' | 'read'>;

export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && user.role === 'admin' && user.shopId) {
            setLoading(true);
            const notificationsRef = collection(db, `shops/${user.shopId}/notifications`);
            const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedNotifications: Notification[] = [];
                snapshot.forEach(doc => {
                    fetchedNotifications.push({ id: doc.id, ...doc.data() } as Notification);
                });
                setNotifications(fetchedNotifications);
                setLoading(false);
            }, (error) => {
                console.error("Error fetching notifications:", error);
                setLoading(false);
            });

            return () => unsubscribe();
        } else {
            // Not an admin or no shopId, so no notifications to fetch
            setNotifications([]);
            setLoading(false);
        }
    }, [user]);

    const markAsRead = async (notificationId: string) => {
        if (user && user.shopId) {
            const notifRef = doc(db, `shops/${user.shopId}/notifications`, notificationId);
            try {
                await updateDoc(notifRef, { read: true });
            } catch (error) {
                console.error("Error marking notification as read:", error);
            }
        }
    };

    return { notifications, loading, markAsRead };
}

// Function to create a notification, can be called from anywhere
export const createNotification = async (shopId: string, data: NotificationData) => {
    try {
        const shopRef = doc(db, 'shops', shopId);
        const shopSnap = await getDoc(shopRef);

        if (!shopSnap.exists()) {
            throw new Error("Shop not found");
        }

        const ownerId = shopSnap.data().ownerId;
        if (!ownerId) {
             throw new Error("Shop owner not found");
        }

        const notificationRef = collection(db, `shops/${shopId}/notifications`);
        
        await addDoc(notificationRef, {
            ...data,
            uid: ownerId, // Target the shop owner
            read: false,
            createdAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
};

    