
"use client";

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';

export type AppUser = User & {
    role?: string;
    name?: string;
    dob?: string;
};

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        const userDocRef = doc(db, 'users', authUser.uid);
        
        const userDocUnsubscribe = onSnapshot(userDocRef, (userDoc) => {
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setUser({ 
                ...authUser, 
                role: userData.role,
                name: userData.name || authUser.displayName,
                dob: userData.dob,
              });
            } else {
              setUser(authUser);
            }
            setLoading(false);
        });

        return () => userDocUnsubscribe();

      } else {
        setUser(null);
        setLoading(false);
        const isPublicPage = ['/login', '/signup', '/'].includes(pathname);
        if (!isPublicPage) {
          router.push('/login');
        }
      }
    });

    return () => authUnsubscribe();
  }, [router, pathname]);

  const updateUser = async (uid: string, data: { name: string; dob: string }) => {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, data);
    // The onSnapshot listener will now automatically update the state.
  };

  return { user, loading, updateUser };
}
