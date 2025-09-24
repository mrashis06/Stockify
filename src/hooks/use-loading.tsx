
"use client";

import { create } from 'zustand';
import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect, createContext, useContext, useRef } from 'react';

type LoadingStore = {
  isLoading: boolean;
  progress: number;
  pageName: string;
  dataReady: boolean;
  _internalState: {
    intervalId: NodeJS.Timeout | null;
    timeoutId: NodeJS.Timeout | null;
    path: string | null;
  };
};

type LoadingActions = {
    showLoader: (pageName: string, path: string) => void;
    hideLoader: () => void;
    setDataReady: () => void;
};

const useLoadingStore = create<LoadingStore & LoadingActions>((set, get) => ({
  isLoading: false,
  progress: 0,
  pageName: '',
  dataReady: false,
  _internalState: {
    intervalId: null,
    timeoutId: null,
    path: null,
  },
  
  hideLoader: () => {
    const { intervalId, timeoutId } = get()._internalState;
    if (intervalId) clearInterval(intervalId);
    if (timeoutId) clearTimeout(timeoutId);
    set({
      isLoading: false,
      progress: 0,
      dataReady: false,
      _internalState: { intervalId: null, timeoutId: null, path: null },
    });
  },

  setDataReady: () => {
      set({ dataReady: true });
      // If progress is already done, this allows hiding the loader.
      if (get().progress >= 100) {
          get().hideLoader();
      }
  },

  showLoader: (pageName, path) => {
    const { hideLoader } = get();
    hideLoader(); // Clear any existing loaders immediately

    set({
      isLoading: true,
      progress: 0,
      pageName,
      dataReady: false,
      _internalState: { ...get()._internalState, path: path },
    });
    
    const intervalId = setInterval(() => {
      set(state => {
        const newProgress = state.progress + 5;
        if (newProgress >= 100) {
          clearInterval(intervalId);
          if (state.dataReady) {
            // Data is ready and animation is done, hide immediately.
            hideLoader();
          }
          // Otherwise, wait for setDataReady to call hideLoader.
          return { progress: 100 };
        }
        return { progress: newProgress };
      });
    }, 80); // ~1.6 seconds to 100%

    // Fallback timeout to prevent getting stuck
    const timeoutId = setTimeout(() => {
        const { isLoading, progress } = get();
        if (isLoading && progress < 100) {
            // Force completion if still loading after 2.5s
            hideLoader();
        }
    }, 2500);

    set(state => ({
      _internalState: { ...state._internalState, intervalId, timeoutId },
    }));
  },
}));

const LoadingContext = createContext<{
    isLoading: boolean;
    progress: number;
    pageName: string;
    showLoader: (pageName: string, path: string) => void;
} | undefined>(undefined);

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

    // Handle browser back/forward navigation
    useEffect(() => {
        // This part is tricky with Next.js App Router.
        // A simple solution is to ensure the loader is hidden on path changes
        // that are not controlled by our `showLoader` function.
        const handlePathChange = () => {
             const { isLoading, _internalState } = useLoadingStore.getState();
             if (isLoading && pathname !== _internalState.path) {
                 // If the router path changes and it's not our target, something else happened (e.g. back button).
                 // We can't easily predict the destination page name here, so we just hide the loader.
                 useLoadingStore.getState().hideLoader();
             }
        };
        handlePathChange();
    }, [pathname]);
    
    return (
        <LoadingContext.Provider value={{ ...store, showLoader }}>
            {children}
        </LoadingContext.Provider>
    );
};

export const useLoading = () => {
    const context = useContext(LoadingContext);
    if (context === undefined) {
        throw new Error('useLoading must be used within a LoadingProvider');
    }
    return context;
};

export const usePageLoading = (pageIsLoading: boolean) => {
    const { setDataReady, isLoading } = useLoadingStore();
    
    useEffect(() => {
        if (!pageIsLoading && isLoading) {
            setDataReady();
        }
    }, [pageIsLoading, isLoading, setDataReady]);
};
