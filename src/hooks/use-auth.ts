
"use client";

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUser({ 
            ...user, 
            role: userData.role,
            name: userData.name || user.displayName,
            dob: userData.dob,
          });
        } else {
          setUser(user);
        }
      } else {
        setUser(null);
        // If user is not logged in, and not on a public page, redirect to login
        const isPublicPage = ['/login', '/signup', '/'].includes(pathname);
        if (!isPublicPage) {
          router.push('/login');
        }
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router, pathname]);

  const updateUser = async (uid: string, data: { name: string; dob: string }) => {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, data);
    // Optimistically update local user state
    setUser(prevUser => {
        if (!prevUser) return null;
        return {
            ...prevUser,
            name: data.name,
            dob: data.dob,
        }
    });
  };

  return { user, loading, updateUser };
}
