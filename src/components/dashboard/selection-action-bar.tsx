
"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

type SelectionActionBarProps = {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
};

const SelectionActionBar: React.FC<SelectionActionBarProps> = ({
  count,
  onClear,
  children
}) => {
  const hasSelection = count > 0;

  return (
    <AnimatePresence>
      {hasSelection && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-center"
        >
          <div className="w-full max-w-sm sm:max-w-md rounded-2xl border bg-background/80 p-3 shadow-lg backdrop-blur-md">
            <div className="flex w-full flex-col gap-3">
              <div className="flex items-center gap-2 px-1">
                 <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  onClick={onClear}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Clear selection</span>
                </Button>
                <p className="flex-1 text-sm font-medium">
                  {count} selected
                </p>
              </div>
              
              <Separator />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {children}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SelectionActionBar;
