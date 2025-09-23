
"use client";

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';

export type AppUser = User & {
    role?: string;
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
          setUser({ ...user, ...userDoc.data() });
          // If user is on login/signup, redirect to dashboard
          if (['/login', '/signup'].includes(pathname)) {
            router.push('/dashboard');
          }
        } else {
          // New user who just signed up with a provider but doc not created yet,
          // or a user whose DB entry was deleted.
          // Let them proceed to create a doc (e.g. on signup page)
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

  return { user, loading };
}
