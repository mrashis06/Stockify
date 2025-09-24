
"use client";

import { create } from 'zustand';
import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect, createContext, useContext, useRef } from 'react';

type LoadingStore = {
  isLoading: boolean;
  progress: number;
  pageName: string;
  dataReady: boolean;
  _interval: NodeJS.Timeout | null;
  _path: string | null;
};

type LoadingActions = {
    showLoader: (pageName: string, path: string) => void;
    hideLoader: () => void;
    setDataReady: (isReady: boolean) => void;
};

const useLoadingStore = create<LoadingStore & LoadingActions>((set, get) => ({
  isLoading: false,
  progress: 0,
  pageName: '',
  dataReady: false,
  _interval: null,
  _path: null,
  showLoader: (pageName, path) => {
    if (get()._interval) {
      clearInterval(get()._interval as NodeJS.Timeout);
    }

    set({ isLoading: true, progress: 0, pageName, _path: path, dataReady: false });

    const interval = setInterval(() => {
      set(state => {
          const newProgress = state.progress + 5;
          if (newProgress >= 100) {
              clearInterval(interval);
              // If data is also ready, hide the loader. Otherwise, wait.
              if (get().dataReady) {
                  get().hideLoader();
              }
              return { progress: 100 };
          }
          return { progress: newProgress };
      });
    }, 80); // ~1.6 seconds to get to 100%

    set({ _interval: interval });
  },
  hideLoader: () => {
    // This is now called internally when conditions are met
    setTimeout(() => {
      set({ isLoading: false });
    }, 300); // Small delay for fade-out
  },
  setDataReady: (isReady) => {
    set({ dataReady: isReady });
    // If the animation has already finished, and we just got data, hide loader.
    if (isReady && get().progress === 100) {
      get().hideLoader();
    }
  },
}));


// Create a context
const LoadingContext = createContext<{
    isLoading: boolean;
    progress: number;
    pageName: string;
    showLoader: (pageName: string, path: string) => void;
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
    const { setDataReady, isLoading } = useLoadingStore();
    
    useEffect(() => {
        if (!pageIsLoading && isLoading) {
            setDataReady(true);
        }
         // Reset dataReady state when the component unmounts or page starts loading again
        return () => {
            setDataReady(false);
        };
    }, [pageIsLoading, isLoading, setDataReady]);
};
