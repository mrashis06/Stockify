
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { parseISO } from 'date-fns';
import { CalendarIcon, ChevronRight, LogOut, Camera, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';

import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useDateFormat, supportedDateFormats } from '@/hooks/use-date-format';
import { useNotificationSettings } from '@/hooks/use-notification-settings';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dob: z.date({
    required_error: "A date of birth is required.",
  }),
});

type ProfileFormValues = z.infer<typeof formSchema>;

const SettingsItem = ({ label, description, children, isInteractive = false }: { label: string; description: string; children: React.ReactNode, isInteractive?: boolean }) => (
    <div className="flex items-center justify-between py-4">
      <div className="flex flex-col">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </div>
      {isInteractive ? (
        <div className="w-[180px]">
          {children}
        </div>
      ) : (
        <div className="flex items-center text-muted-foreground">
          <span>{children}</span>
          {!isInteractive && <ChevronRight className="h-4 w-4 ml-2" />}
        </div>
      )}
    </div>
);
  
  const UserProfileItem = ({ label, description, isLogout = false, onClick }: { label: string, description:string, isLogout?: boolean, onClick?: () => void }) => (
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={onClick}>
          <div className="flex flex-col">
              <span className={`font-medium ${isLogout ? 'text-destructive' : ''}`}>{label}</span>
              <span className="text-sm text-muted-foreground">{description}</span>
          </div>
          {isLogout ? <LogOut className="h-5 w-5 text-destructive" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
  )

export default function SettingsPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const { dateFormat, setDateFormat, formatDate } = useDateFormat();
  const { settings, setSetting } = useNotificationSettings();
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user?.name || '',
      dob: user?.dob ? parseISO(user.dob) : new Date(),
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || '',
        dob: user.dob ? parseISO(user.dob) : new Date(),
      });
    }
  }, [user, form]);
  
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (!user) return;
      const file = acceptedFiles[0];
      if (!file) return;

      setIsUploading(true);

      const reader = new FileReader();
      reader.onload = (readEvent) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 128;
          const MAX_HEIGHT = 128;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL(file.type);
          
          updateUser(user.uid, { photoURL: dataUrl })
            .then(() => {
                toast({ title: 'Success', description: 'Profile picture updated.' });
            })
            .catch(() => {
                toast({ title: 'Error', description: 'Failed to update profile picture.', variant: 'destructive' });
            })
            .finally(() => {
                setIsUploading(false);
            });
        };
        img.src = readEvent.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [user, updateUser, toast]
  );
  
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [] },
    multiple: false,
    noClick: isUploading,
    noKeyboard: isUploading,
  });


  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    try {
        const updateData = {
            name: data.name,
            dob: data.dob.toISOString().split('T')[0] // format as YYYY-MM-DD
        }
        await updateUser(user.uid, updateData);
        toast({ title: 'Success', description: 'Profile updated successfully.' });
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive' });
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-0">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </header>
      
      <Card className="mb-8">
        <CardHeader>
            <CardTitle>User Profile</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-8">
                <div {...getRootProps()} className="relative shrink-0 group w-24 h-24 sm:w-32 sm:h-32 cursor-pointer">
                    <input {...getInputProps()} />
                    <Avatar className="w-full h-full text-4xl">
                        <AvatarImage src={user?.photoURL || undefined} alt={user?.name || 'User'} />
                        <AvatarFallback>
                            {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                       {isUploading ? (
                           <Loader2 className="h-8 w-8 text-white animate-spin" />
                       ) : (
                           <Camera className="h-8 w-8 text-white" />
                       )}
                    </div>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex-1">
                         <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Full Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Your name" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="dob"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>Date of birth</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-[240px] pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        >
                                        {field.value ? (
                                            formatDate(field.value)
                                        ) : (
                                            <span>Pick a date</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        disabled={(date) =>
                                        date > new Date() || date < new Date("1900-01-01")
                                        }
                                        initialFocus
                                        captionLayout="dropdown-buttons"
                                        fromYear={1900}
                                        toYear={new Date().getFullYear()}
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </form>
                </Form>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y p-0">
            <section>
                <h2 className="text-xl font-semibold mb-2 px-6 pt-6">App Preferences</h2>
                <div className="px-6">
                    <Separator />
                    <SettingsItem label="Language" description="Choose your preferred language for the app interface.">English</SettingsItem>
                    <Separator />
                    <SettingsItem label="Date Format" description="Choose your preferred date format for all date displays." isInteractive={true}>
                        <Select value={dateFormat} onValueChange={setDateFormat}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select format" />
                            </SelectTrigger>
                            <SelectContent>
                                {supportedDateFormats.map(f => (
                                    <SelectItem key={f.format} value={f.format}>{f.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </SettingsItem>
                </div>
            </section>

            <section className="pt-6">
                <h2 className="text-xl font-semibold mb-2 px-6">Notifications</h2>
                <div className="px-6">
                    <Separator />
                    <SettingsItem label="Low Stock Alerts" description="Receive alerts for low stock levels on specific items." isInteractive={true}>
                        <Switch checked={settings.lowStockAlerts} onCheckedChange={(checked) => setSetting('lowStockAlerts', checked)} />
                    </SettingsItem>
                    <Separator />
                    <SettingsItem label="New Order Notifications" description="Get notified when new orders are placed." isInteractive={true}>
                        <Switch checked={settings.newOrderNotifications} onCheckedChange={(checked) => setSetting('newOrderNotifications', checked)} />
                    </SettingsItem>
                    <Separator />
                    <SettingsItem label="Daily Summary" description="Receive daily summaries of sales and inventory changes." isInteractive={true}>
                        <Switch checked={settings.dailySummary} onCheckedChange={(checked) => setSetting('dailySummary', checked)} />
                    </SettingsItem>
                     {user?.role === 'staff' && (
                        <>
                            <Separator />
                            <SettingsItem label="Staff Broadcasts" description="Receive broadcast messages from your admin." isInteractive={true}>
                                <Switch checked={settings.staffBroadcasts} onCheckedChange={(checked) => setSetting('staffBroadcasts', checked)} />
                            </SettingsItem>
                        </>
                    )}
                </div>
            </section>
            
            <section className="pt-6">
                <h2 className="text-xl font-semibold mb-2 px-6">User Profile</h2>
                <div className="divide-y">
                  <Link href="#" className="block hover:bg-muted/50 rounded-md">
                      <UserProfileItem label="Account Settings" description="Manage your account details and security settings." />
                  </Link>
                  <div className="block hover:bg-muted/50 rounded-md" onClick={handleLogout}>
                      <UserProfileItem label="Log Out" description="Log out from the application." isLogout={true} onClick={handleLogout} />
                  </div>
                </div>
            </section>
        </CardContent>
      </Card>
    </div>
  );
}
