
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { format as formatDateFns, parseISO } from 'date-fns';

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
  formatDate: (date: Date | string | number, formatOverride?: string) => string;
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
  
  const formatDate = useCallback((date: Date | string | number, formatOverride: string = dateFormat): string => {
    try {
        let dateObj = date instanceof Date ? date : typeof date === 'string' ? parseISO(date) : new Date(date);
        return formatDateFns(dateObj, formatOverride);
    } catch (error) {
        console.error("Invalid date for formatting:", date);
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
