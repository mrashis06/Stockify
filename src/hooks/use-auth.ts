
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
          if (['/login', '/signup'].includes(pathname)) {
            router.push('/dashboard');
          }
        } else {
          // New user, not in DB yet. Or user exists but document is not found.
           setUser(user);
           if (pathname !== '/signup') {
            // This might happen for a user who signed up but doc creation failed.
            // Or if they are trying to access a protected route without a db entry.
            // Let's guide them to login/signup. If they are on login, they can stay.
           }
        }
      } else {
        setUser(null);
        const isAuthPage = ['/login', '/signup'].includes(pathname);
        const isHomePage = pathname === '/';
        if (!isAuthPage && !isHomePage) {
            router.push('/login');
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  return { user, loading };
}
