
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  signInWithEmailAndPassword, 
  AuthError,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import React, { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Declare `window.recaptchaVerifier` and `window.confirmationResult`
declare global {
  interface Window {
    recaptchaVerifier: RecaptchaVerifier;
    confirmationResult: ConfirmationResult;
  }
}

function EmailLoginTab() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = useState(false);
  
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (error) {
      console.error("Error signing in with email and password: ", error);
      let description = "Failed to sign in. Please try again.";
      if ((error as AuthError).code === 'auth/invalid-credential') {
          description = "Invalid credentials. Please check your email and password and try again.";
      }
      toast({
        title: "Authentication Error",
        description: description,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleEmailSignIn} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          placeholder="m@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="grid gap-2">
          <div className="flex items-center">
              <Label htmlFor="password">Password</Label>
              <Link
                  href="/forgot-password"
                  className="ml-auto inline-block text-sm text-primary underline"
              >
                  Forgot your password?
              </Link>
          </div>
        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Login
      </Button>
    </form>
  );
}

function PhoneLoginTab() {
  const router = useRouter();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    // This effect sets up the reCAPTCHA verifier when the component mounts.
    // It's essential for Firebase Phone Authentication on the web.
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible',
      'callback': (response: any) => {
        // reCAPTCHA solved, allow signInWithPhoneNumber.
      }
    });
    
    // Cleanup the verifier on unmount
    return () => {
      window.recaptchaVerifier.clear();
    };
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formattedPhone = `+${phone.replace(/\D/g, '')}`;
      if (formattedPhone.length < 10) {
        toast({ title: "Error", description: "Please enter a valid phone number.", variant: "destructive" });
        setLoading(false);
        return;
      }
      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, window.recaptchaVerifier);
      window.confirmationResult = confirmationResult;
      setOtpSent(true);
      toast({ title: "OTP Sent", description: "A verification code has been sent to your phone." });
    } catch (error) {
      console.error("Error sending OTP:", error);
      toast({ title: "Error", description: "Failed to send OTP. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await window.confirmationResult.confirm(otp);
      // On successful verification, Firebase signs the user in automatically.
      router.push('/dashboard');
    } catch (error) {
      console.error("Error verifying OTP:", error);
      toast({ title: "Error", description: "Invalid OTP. Please try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="grid gap-4">
      {!otpSent ? (
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+91 98765 43210"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
          />
        </div>
      ) : (
        <div className="grid gap-2">
          <Label htmlFor="otp">Verification Code (OTP)</Label>
          <Input
            id="otp"
            type="text"
            placeholder="Enter the 6-digit code"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            disabled={loading}
            maxLength={6}
          />
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {otpSent ? 'Verify & Login' : 'Send OTP'}
      </Button>
      {otpSent && (
         <Button variant="link" size="sm" className="text-sm" onClick={() => setOtpSent(false)} disabled={loading}>
            Use a different phone number
        </Button>
      )}
    </form>
  );
}


export default function LoginPage({ params, searchParams }: { params: { slug: string }; searchParams?: { [key: string]: string | string[] | undefined } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  useEffect(() => {
    // If the user is already logged in, redirect them to the dashboard.
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);
  
  if (authLoading || user) {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
            <div>Loading...</div>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div id="recaptcha-container"></div>
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Log in to manage your inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email">Email</TabsTrigger>
                <TabsTrigger value="phone">Phone</TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="pt-4">
                <EmailLoginTab />
            </TabsContent>
            <TabsContent value="phone" className="pt-4">
                <PhoneLoginTab />
            </TabsContent>
          </Tabs>

          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
