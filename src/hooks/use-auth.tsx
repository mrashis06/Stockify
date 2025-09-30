
"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { onAuthStateChanged, User, updateProfile } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { ADMIN_UIDS } from '@/lib/constants';

export type AppUser = User & {
    role?: string;
    name?: string;
    dob?: string;
    shopId?: string | null;
    status?: 'active' | 'blocked';
    aadhaar?: string;
    pan?: string;
    photoURL?: string | null;
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
                setLoading(true);
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    
                    if (userData.status === 'blocked') {
                        setUser(null);
                        setShopId(null);
                        setIsStaffActive(false);
                        auth.signOut();
                        setLoading(false);
                        return;
                    }
                    
                    const isUserAdmin = ADMIN_UIDS.includes(authUser.uid);
                    const effectiveRole = isUserAdmin ? 'admin' : userData.role || 'staff';

                    if (isUserAdmin && userData.role !== 'admin') {
                        updateDoc(userDocRef, { role: 'admin' });
                    }

                    const fullUser: AppUser = {
                        ...authUser,
                        displayName: userData.name || authUser.displayName,
                        photoURL: userData.photoURL || authUser.photoURL,
                        role: effectiveRole,
                        name: userData.name || authUser.displayName,
                        dob: userData.dob,
                        shopId: userData.shopId,
                        status: userData.status,
                        aadhaar: userData.aadhaar,
                        pan: userData.pan,
                    };

                    setUser(fullUser);
                    setShopId(userData.shopId || null);
                    setIsStaffActive(userData.status === 'active');

                } else {
                    auth.signOut();
                    setUser(null);
                    setShopId(null);
                    setIsStaffActive(false);
                }
                 setLoading(false);
            }, (error) => {
                console.error("Error fetching user data:", error);
                setUser(authUser); 
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
      
      // Also update the auth user profile if name or photoURL are changed
      if (auth.currentUser && auth.currentUser.uid === uid && (data.name || data.photoURL)) {
          await updateProfile(auth.currentUser, {
            displayName: data.name,
            photoURL: data.photoURL,
          });
      }
  };
  
  const value = { user, loading, updateUser, shopId, isStaffActive };

  return (
    <AuthContext.Provider value={value}>
        {children}
    </AuthContext.Provider>
  );
}
