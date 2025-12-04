
"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
          className={cn(
            "fixed bottom-4 left-4 right-4 z-50 flex items-center justify-center",
            "sm:left-1/2 sm:right-auto sm:w-auto sm:-translate-x-1/2"
          )}
        >
          <div className="flex w-full items-center gap-2 rounded-full border bg-background/80 p-2 pl-4 shadow-lg backdrop-blur-md sm:w-auto">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={onClear}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear selection</span>
            </Button>
            <p className="flex-1 text-sm font-medium sm:flex-initial">
              {count} selected
            </p>
            <div className="flex items-center gap-2">
              {children}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SelectionActionBar;
