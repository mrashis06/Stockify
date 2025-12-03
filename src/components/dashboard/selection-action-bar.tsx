
"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type SelectionActionBarProps = {
  count: number;
  onClear: () => void;
  onAction: () => void;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
};

const SelectionActionBar: React.FC<SelectionActionBarProps> = ({
  count,
  onClear,
  onAction,
  actionLabel = 'Delete',
  actionIcon,
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
          className={cn(
            "fixed bottom-4 z-50 w-auto max-w-[calc(100%-2rem)]", // Ensure it doesn't overflow on small screens
            "left-1/2 -translate-x-1/2", // Centering trick
            "md:left-1/2 md:-translate-x-1/2", // Centered on desktop
            "sm:w-auto" // Auto width on larger screens
          )}
        >
          <div className="flex items-center gap-4 rounded-full border bg-background/80 p-2 pl-4 shadow-lg backdrop-blur-md">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={onClear}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear selection</span>
            </Button>
            <p className="text-sm font-medium">
              {count} selected
            </p>
            <Button
              size="sm"
              variant="destructive"
              onClick={onAction}
              className="rounded-full"
            >
              {actionIcon}
              <span className="ml-2">{actionLabel}</span>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SelectionActionBar;
