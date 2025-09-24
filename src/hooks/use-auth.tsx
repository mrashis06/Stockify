"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type AppUser = User & {
    role?: string;
    name?: string;
    dob?: string;
};

type AuthContextType = {
    user: AppUser | null;
    loading: boolean;
    updateUser: (uid: string, data: Partial<AppUser>) => Promise<void>;
}

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
        if (authUser) {
            const userDocRef = doc(db, 'users', authUser.uid);
            const unsubDoc = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const userData = docSnap.data();
                    setUser({
                        ...authUser,
                        displayName: userData.name || authUser.displayName,
                        role: userData.role,
                        name: userData.name || authUser.displayName,
                        dob: userData.dob,
                    });
                } else {
                    setUser(authUser); // Auth user exists, but no firestore doc yet
                }
                 setLoading(false);
            }, (error) => {
                console.error("Error fetching user data:", error);
                setUser(authUser);
                setLoading(false);
            });
            return () => unsubDoc(); // Cleanup firestore listener
        } else {
            setUser(null);
            setLoading(false);
        }
    });

    return () => unsubscribe(); // Cleanup auth listener
  }, []);
  
  const updateUser = async (uid: string, data: Partial<AppUser>) => {
      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, data);
  };

  const value = { user, loading, updateUser };

  return (
    <AuthContext.Provider value={value}>
        {children}
    </AuthContext.Provider>
  );
}