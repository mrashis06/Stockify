
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, AuthError } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ADMIN_UIDS } from '@/lib/constants';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';

const formSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits').max(15, 'Phone number is too long'),
    dob: z.date({ required_error: 'Date of birth is required.' }),
    aadhaar: z.string().length(12, 'Aadhaar number must be 12 digits'),
    pan: z.string().length(10, 'PAN number must be 10 characters').regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof formSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const form = useForm<SignupFormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: {
          name: '',
          email: '',
          phone: '',
          aadhaar: '',
          pan: '',
          password: '',
          confirmPassword: '',
      }
  });

  const onSubmit = async (data: SignupFormValues) => {
    setLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      
      const role = ADMIN_UIDS.includes(user.uid) ? 'admin' : 'staff';

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: data.name,
        email: data.email,
        phone: data.phone,
        dob: format(data.dob, 'yyyy-MM-dd'),
        aadhaar: data.aadhaar,
        pan: data.pan.toUpperCase(),
        role: role,
        status: 'active', // All new users are active by default
        shopId: null, // Staff will set this in the next step
        createdAt: serverTimestamp(),
      });
      
      if (role === 'staff' || !ADMIN_UIDS.includes(user.uid)) {
          router.push('/join-shop');
      } else {
          router.push('/join-shop');
      }

    } catch (error) {
      console.error("Error signing up with email and password: ", error);
      const authError = error as AuthError;
      
      let description = "Failed to sign up. Please try again.";
      if (authError.code === 'auth/email-already-in-use') {
        description = "This email is already registered. If this is you, please log in. If you were removed as staff, you cannot sign up again with this email.";
      } else if (authError.code === 'auth/weak-password') {
        description = "The password is too weak. Please choose a stronger password.";
      }

      toast({
        title: "Signup Error",
        description: description,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
          <CardDescription>
            Get started with smart inventory management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
               <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} disabled={loading} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email address</FormLabel><FormControl><Input type="email" placeholder="m@example.com" {...field} disabled={loading} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="Your phone number" {...field} disabled={loading} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="dob" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Date of birth</FormLabel>
                            <Popover><PopoverTrigger asChild>
                                <FormControl>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus captionLayout="dropdown-buttons" fromYear={1900} toYear={new Date().getFullYear()}/>
                            </PopoverContent></Popover>
                        <FormMessage /></FormItem>
                    )} />
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="aadhaar" render={({ field }) => (
                        <FormItem><FormLabel>Aadhaar Number</FormLabel><FormControl><Input placeholder="12-digit number" {...field} disabled={loading} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="pan" render={({ field }) => (
                        <FormItem><FormLabel>PAN Number</FormLabel><FormControl><Input placeholder="10-character PAN" {...field} disabled={loading} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} disabled={loading} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                    <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><Input type="password" {...field} disabled={loading} /></FormControl><FormMessage /></FormItem>
                )} />

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign Up
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="text-primary underline">
              Log In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    