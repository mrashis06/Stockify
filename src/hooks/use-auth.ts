
"use client";

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

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
        
        // Listen for changes on the user document
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
              // This case might happen if the user doc hasn't been created yet.
              setUser(authUser);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error listening to user document:", error);
            setUser(authUser); // Fallback to authUser
            setLoading(false);
        });

        // Cleanup the listener for the user document
        return () => userDocUnsubscribe();

      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Cleanup the auth state listener
    return () => unsubscribe();
  }, []);


  const updateUser = async (uid: string, data: { name: string; dob: string }) => {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, data);
    // The onSnapshot listener will automatically update the user state.
  };

  return { user, loading, updateUser };
}
