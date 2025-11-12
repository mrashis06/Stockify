
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { format as formatDateFns, parseISO, isValid } from 'date-fns';

export const supportedDateFormats = [
    { format: 'dd-MM-yyyy', label: 'DD-MM-YYYY' },
    { format: 'MM-dd-yyyy', label: 'MM-DD-YYYY' },
    { format: 'yyyy-MM-dd', label: 'YYYY-MM-DD' },
    { format: 'PPP', label: 'Month D, YYYY' }, // e.g., Jun 21, 2024
] as const;

type DateFormat = typeof supportedDateFormats[number]['format'];

type DateFormatContextType = {
  dateFormat: DateFormat;
  setDateFormat: (format: DateFormat) => void;
  formatDate: (date: Date | string | number | undefined, formatOverride?: string) => string;
};

const DateFormatContext = createContext<DateFormatContextType | undefined>(undefined);

export const DateFormatProvider = ({ children }: { children: ReactNode }) => {
  const [dateFormat, setDateFormatState] = useState<DateFormat>('dd-MM-yyyy');

  useEffect(() => {
    const storedFormat = localStorage.getItem('dateFormat') as DateFormat;
    if (storedFormat && supportedDateFormats.some(f => f.format === storedFormat)) {
      setDateFormatState(storedFormat);
    }
  }, []);

  const setDateFormat = (newFormat: DateFormat) => {
    setDateFormatState(newFormat);
    localStorage.setItem('dateFormat', newFormat);
  };
  
  const formatDate = useCallback((date: Date | string | number | undefined, formatOverride: string = dateFormat): string => {
    if (!date) {
        return 'N/A';
    }
    try {
        let dateObj;
        if (date instanceof Date) {
            dateObj = date;
        } else if (typeof date === 'string') {
            dateObj = parseISO(date);
        } else if (typeof date === 'number') {
            dateObj = new Date(date);
        } else {
             return 'Invalid Date';
        }

        if (!isValid(dateObj)) {
            return 'Invalid Date';
        }

        return formatDateFns(dateObj, formatOverride);
    } catch (error) {
        return 'Invalid Date';
    }
  }, [dateFormat]);


  return (
    <DateFormatContext.Provider value={{ dateFormat, setDateFormat, formatDate }}>
      {children}
    </DateFormatContext.Provider>
  );
};

export const useDateFormat = () => {
  const context = useContext(DateFormatContext);
  if (context === undefined) {
    throw new Error('useDateFormat must be used within a DateFormatProvider');
  }
  return context;
};
