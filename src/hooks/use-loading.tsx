
"use client";

import { create } from 'zustand';
import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect, createContext, useContext } from 'react';

type LoadingStore = {
  isLoading: boolean;
  progress: number;
  pageName: string;
  _interval: NodeJS.Timeout | null;
  _path: string | null;
};

type LoadingActions = {
    showLoader: (pageName: string, path: string) => void;
    hideLoader: () => void;
    setProgress: (progress: number) => void;
};

const useLoadingStore = create<LoadingStore & LoadingActions>((set, get) => ({
  isLoading: false,
  progress: 0,
  pageName: '',
  _interval: null,
  _path: null,
  showLoader: (pageName, path) => {
    if (get()._interval) {
      clearInterval(get()._interval as NodeJS.Timeout);
    }

    set({ isLoading: true, progress: 0, pageName, _path: path });

    const interval = setInterval(() => {
      set(state => {
          // Quickly ramp up to 90%
          const newProgress = state.progress + Math.floor(Math.random() * 15) + 5;
          if (newProgress >= 90) {
              clearInterval(interval);
              return { progress: 90 };
          }
          return { progress: newProgress };
      });
    }, 150); // Faster interval for a quicker ramp-up

    set({ _interval: interval });
  },
  hideLoader: () => {
    const state = get();
    if (state._interval) {
      clearInterval(state._interval);
    }
    // Animate from 90 to 100
    set({ progress: 100 });
    
    // Wait for the final animation and a small delay, then hide
    setTimeout(() => {
      set({ isLoading: false });
    }, 700); // This delay includes the animation to 100% + fade-out time
  },
  setProgress: (progress) => set({ progress }),
}));


// Create a context
const LoadingContext = createContext<{
    isLoading: boolean;
    progress: number;
    pageName: string;
    showLoader: (pageName: string, path: string) => void;
    hideLoader: () => void;
} | undefined>(undefined);


// Create the provider component
export const LoadingProvider = ({ children }: { children: React.ReactNode }) => {
    const store = useLoadingStore();
    const router = useRouter();
    const pathname = usePathname();

    const showLoader = (pageName: string, path: string) => {
        if (pathname !== path) {
            store.showLoader(pageName, path);
            router.push(path);
        }
    };
    
    // This effect will run when the route changes, but after the page component starts rendering.
    useEffect(() => {
        // If the loader was shown for a path, and now we are on that path,
        // we let the page's own loading state take over.
        if (store.isLoading && store._path === pathname) {
            // The `usePageLoading` hook will call `hideLoader` when the page is ready.
        }
    }, [pathname, store.isLoading, store._path]);

    return (
        <LoadingContext.Provider value={{ ...store, showLoader }}>
            {children}
        </LoadingContext.Provider>
    );
};

// Custom hook to use the loading context
export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (context === undefined) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
};

// This hook is for pages to signal when they are done loading data
export const usePageLoading = (pageIsLoading: boolean) => {
    const { hideLoader, isLoading } = useLoadingStore();
    
    useEffect(() => {
        if (!pageIsLoading && isLoading) {
            hideLoader();
        }
    }, [pageIsLoading, isLoading, hideLoader]);
};
