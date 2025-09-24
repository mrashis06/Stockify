
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
        // Increment progress, but don't exceed 99 until we know data is ready
        const newProgress = Math.min(state.progress + 5, 99);
        
        // If the page's data is ready, we can complete the animation to 100%
        if (state.dataReady) {
            clearInterval(interval);
            // Animate the final step to 100%
            set({ progress: 100 });
            // Then hide the loader after a short delay for the animation to finish
            setTimeout(() => {
                get().hideLoader();
            }, 300);
        }
        
        return { progress: newProgress };
      });
    }, 80); // ~1.6 seconds to get to 99%

    set({ _interval: interval });
  },
  hideLoader: () => {
    // Clear any existing interval to prevent conflicts
    if (get()._interval) {
        clearInterval(get()._interval as NodeJS.Timeout);
    }
    set({ isLoading: false, progress: 0, _interval: null });
  },
  setDataReady: (isReady) => {
    if (isReady && !get().dataReady) {
        set({ dataReady: true });
        
        // This is the key part: if the animation is already near completion,
        // and we just received data, we trigger the final step.
        const currentState = get();
        if (currentState._interval && currentState.progress >= 90) {
            clearInterval(currentState._interval);
            set({ progress: 100 });
            setTimeout(() => {
                get().hideLoader();
            }, 300);
        }
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
            // Important: don't set to false if we are no longer in a loading state
            if (useLoadingStore.getState().isLoading) {
                 setDataReady(false);
            }
        };
    }, [pageIsLoading, isLoading, setDataReady]);
};
