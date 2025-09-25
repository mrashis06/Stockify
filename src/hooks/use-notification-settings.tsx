
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

type NotificationSettings = {
  lowStockAlerts: boolean;
  newOrderNotifications: boolean;
  dailySummary: boolean;
};

type SettingKey = keyof NotificationSettings;

type NotificationSettingsContextType = {
  settings: NotificationSettings;
  setSetting: (key: SettingKey, value: boolean) => void;
};

const NotificationSettingsContext = createContext<NotificationSettingsContextType | undefined>(undefined);

const defaultSettings: NotificationSettings = {
    lowStockAlerts: true,
    newOrderNotifications: true,
    dailySummary: false,
};

export const NotificationSettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);

    useEffect(() => {
        try {
            const storedSettings = localStorage.getItem('notificationSettings');
            if (storedSettings) {
                const parsedSettings = JSON.parse(storedSettings);
                // Merge with defaults to ensure all keys are present
                setSettings({ ...defaultSettings, ...parsedSettings });
            }
        } catch (error) {
            console.error("Failed to parse notification settings from localStorage", error);
        }
    }, []);

    const setSetting = (key: SettingKey, value: boolean) => {
        setSettings(prevSettings => {
            const newSettings = { ...prevSettings, [key]: value };
            try {
                localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
            } catch (error) {
                 console.error("Failed to save notification settings to localStorage", error);
            }
            return newSettings;
        });
    };

    return (
        <NotificationSettingsContext.Provider value={{ settings, setSetting }}>
            {children}
        </NotificationSettingsContext.Provider>
    );
};

export const useNotificationSettings = () => {
  const context = useContext(NotificationSettingsContext);
  if (context === undefined) {
    throw new Error('useNotificationSettings must be used within a NotificationSettingsProvider');
  }
  return context;
};
