
"use client";

import React from 'react';
import { ChevronRight, LogOut } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

const SettingsItem = ({ label, description, value, isToggle = false, onToggleChange, defaultChecked }: { label: string, description: string, value: string, isToggle?: boolean, onToggleChange?: (checked: boolean) => void, defaultChecked?: boolean }) => (
  <div className="flex items-center justify-between py-4">
    <div className="flex flex-col">
      <span className="font-medium">{label}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </div>
    {isToggle ? (
        <Switch onCheckedChange={onToggleChange} defaultChecked={defaultChecked} />
    ) : (
        <div className="flex items-center text-muted-foreground">
        <span>{value}</span>
        <ChevronRight className="h-4 w-4 ml-2" />
        </div>
    )}
  </div>
);

const UserProfileItem = ({ label, description, isLogout = false, onClick }: { label: string, description:string, isLogout?: boolean, onClick?: () => void }) => (
    <div className="flex items-center justify-between py-4" onClick={onClick}>
        <div className="flex flex-col">
            <span className={`font-medium ${isLogout ? 'text-destructive' : ''}`}>{label}</span>
            <span className="text-sm text-muted-foreground">{description}</span>
        </div>
        {isLogout ? <LogOut className="h-5 w-5 text-destructive" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </div>
)

export default function SettingsPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </header>
      
      <Card>
        <CardContent className="p-6">
            <section>
                <h2 className="text-xl font-semibold mb-2">App Preferences</h2>
                <Separator />
                <SettingsItem label="Language" description="Choose your preferred language for the app interface." value="English" />
                <Separator />
                <SettingsItem label="Currency" description="Select the currency for all financial displays." value="Indian Rupee (₹)" />
                <Separator />
                <SettingsItem label="Date Format" description="Choose your preferred date format for all date displays." value="DD/MM/YYYY" />
            </section>

            <section className="mt-8">
                <h2 className="text-xl font-semibold mb-2">Notifications</h2>
                <Separator />
                <SettingsItem label="Low Stock Alerts" description="Receive alerts for low stock levels on specific items." value="" isToggle={true} defaultChecked={true} />
                <Separator />
                <SettingsItem label="New Order Notifications" description="Get notified when new orders are placed." value="" isToggle={true} defaultChecked={true} />
                <Separator />
                <SettingsItem label="Daily Summary" description="Receive daily summaries of sales and inventory changes." value="" isToggle={true} defaultChecked={false} />
            </section>
            
            <section className="mt-8">
                <h2 className="text-xl font-semibold mb-2">User Profile</h2>
                <Separator />
                <Link href="#" className="block hover:bg-muted/50 rounded-md">
                    <UserProfileItem label="Account Settings" description="Manage your account details and security settings." />
                </Link>
                <Separator />
                <Link href="#" className="block hover:bg-muted/50 rounded-md">
                    <UserProfileItem label="Subscription Plan" description="View and manage your subscription plan." />
                </Link>
                <Separator />
                 <Button variant="ghost" className="w-full justify-start p-0 h-auto hover:bg-muted/50 rounded-md" onClick={handleLogout}>
                    <UserProfileItem label="Log Out" description="Log out from the application." isLogout={true} />
                </Button>
            </section>
        </CardContent>
      </Card>
    </div>
  );
}
