
"use client";

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, ChevronRight, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';

import { auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
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


const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  dob: z.date({
    required_error: "A date of birth is required.",
  }),
});

type ProfileFormValues = z.infer<typeof formSchema>;

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
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

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
  

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    try {
        const updateData = {
            name: data.name,
            dob: format(data.dob, 'yyyy-MM-dd')
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
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                                        format(field.value, "PPP")
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
                    <Button type="submit">Save Changes</Button>
                </form>
            </Form>
        </CardContent>
      </Card>

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
