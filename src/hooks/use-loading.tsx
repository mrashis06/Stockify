
"use client";

import { create } from 'zustand';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

type LoadingState = {
  isLoading: boolean;
  progress: number;
  pageName: string;
  actions: {
    showLoader: (pageName: string, path: string) => void;
    hideLoader: () => void;
    setProgress: (progress: number) => void;
  };
};

const useLoadingStore = create<LoadingState>((set, get) => ({
  isLoading: false,
  progress: 0,
  pageName: '',
  actions: {
    showLoader: (pageName, path) => {
      set({ isLoading: true, progress: 0, pageName });

      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += Math.floor(Math.random() * 10) + 5;
        if (currentProgress >= 90) {
          clearInterval(interval);
        }
        set({ progress: Math.min(currentProgress, 90) });
      }, 200);

      // Store interval to clear it if another navigation starts
      (get() as any)._interval = interval;
      (get() as any)._path = path;
    },
    hideLoader: () => {
      const interval = (get() as any)._interval;
      if (interval) {
        clearInterval(interval);
      }
      set({ progress: 100 });
      setTimeout(() => {
        set({ isLoading: false });
      }, 500); // Fade-out duration
    },
    setProgress: (progress) => set({ progress }),
  },
}));

export const useLoading = () => {
    const { isLoading, progress, pageName } = useLoadingStore();
    const { showLoader, hideLoader } = useLoadingStore(state => state.actions);
    const router = useRouter();

    const memoizedShowLoader = (pageName: string, path: string) => {
        const interval = (useLoadingStore.getState() as any)._interval;
        if (interval) {
            clearInterval(interval);
        }
        showLoader(pageName, path);
        // We handle the navigation here after showing the loader
        setTimeout(() => router.push(path), 50); 
    };

    return { isLoading, progress, pageName, showLoader: memoizedShowLoader, hideLoader };
};

export const usePageLoading = (pageIsLoading: boolean) => {
    const { hideLoader, isLoading } = useLoadingStore(state => ({...state.actions, isLoading: state.isLoading}));
    
    useEffect(() => {
        if (!pageIsLoading && isLoading) {
            hideLoader();
        }
    }, [pageIsLoading, isLoading, hideLoader]);
}
