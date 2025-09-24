
"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type AppUser = User & {
    role?: string;
    name?: string;
    dob?: string;
    shopId?: string | null;
    status?: 'active' | 'blocked';
};

type AuthContextType = {
    user: AppUser | null;
    loading: boolean;
    updateUser: (uid: string, data: Partial<AppUser>) => Promise<void>;
    shopId: string | null;
    isStaffActive: boolean;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);


export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState<string | null>(null);
  const [isStaffActive, setIsStaffActive] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
        if (authUser) {
            const userDocRef = doc(db, 'users', authUser.uid);
            const unsubDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                     // Prevent login if user is blocked
                    if (userData.status === 'blocked') {
                        setUser(null);
                        setShopId(null);
                        setIsStaffActive(false);
                        auth.signOut(); // Ensure they are fully logged out
                        setLoading(false);
                        return;
                    }
                    
                    const fullUser: AppUser = {
                        ...authUser,
                        displayName: userData.name || authUser.displayName,
                        role: userData.role,
                        name: userData.name || authUser.displayName,
                        dob: userData.dob,
                        shopId: userData.shopId,
                        status: userData.status,
                    };
                    setUser(fullUser);
                    setShopId(userData.shopId || null);
                    setIsStaffActive(userData.status === 'active');
                } else {
                    // This can happen if the user's doc is deleted but they are still logged in.
                    // We should log them out.
                    auth.signOut();
                    setUser(null);
                    setShopId(null);
                    setIsStaffActive(false);
                }
                 setLoading(false);
            }, (error) => {
                console.error("Error fetching user data:", error);
                setUser(authUser); // Fallback to authUser
                setLoading(false);
            });
            return () => unsubDoc();
        } else {
            setUser(null);
            setShopId(null);
            setIsStaffActive(false);
            setLoading(false);
        }
    });

    return () => unsubscribe();
  }, []);
  
  const updateUser = async (uid: string, data: Partial<AppUser>) => {
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, data);
  };
  
  const value = { user, loading, updateUser, shopId, isStaffActive };

  return (
    <AuthContext.Provider value={value}>
        {children}
    </AuthContext.Provider>
  );
}

    