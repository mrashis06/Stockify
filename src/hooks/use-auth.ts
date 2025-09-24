
"use client";

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export type AppUser = User & {
    role?: string;
    name?: string;
    dob?: string;
};

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        const userDocRef = doc(db, 'users', authUser.uid);
        
        const userDocUnsubscribe = onSnapshot(userDocRef, (userDoc) => {
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setUser({ 
                ...authUser, 
                displayName: userData.name || authUser.displayName,
                role: userData.role,
                name: userData.name || authUser.displayName,
                dob: userData.dob,
              });
            } else {
              setUser(authUser);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error listening to user document:", error);
            setUser(authUser);
            setLoading(false);
        });

        return () => userDocUnsubscribe();

      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);


  const updateUser = async (uid: string, data: { name: string; dob: string }) => {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, data);
  };

  return { user, loading, updateUser };
}
