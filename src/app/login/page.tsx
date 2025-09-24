
"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  signInWithEmailAndPassword, 
  signOut,
  AuthError
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
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
import { Loader2, Package } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLoading } from '@/hooks/use-loading';

// Define LoginForm as a standalone component outside of LoginPage
const LoginForm = ({
  email,
  setEmail,
  password,
  setPassword,
  loading,
  handleEmailSignIn,
  authError,
  role
}: {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  loading: boolean;
  handleEmailSignIn: (e: React.FormEvent, role: 'admin' | 'staff') => Promise<void>;
  authError: string;
  role: 'admin' | 'staff';
}) => (
   <form onSubmit={(e) => handleEmailSignIn(e, role)} className="grid gap-4">
      {authError && (
            <Alert variant="destructive" className="mb-2">
                <AlertDescription>{authError}</AlertDescription>
            </Alert>
        )}
      <div className="grid gap-2">
        <Label htmlFor={`email-${role}`}>Email address</Label>
        <Input
          id={`email-${role}`}
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
              <Label htmlFor={`password-${role}`}>Password</Label>
              <Link
                  href="/forgot-password"
                  className="ml-auto inline-block text-sm text-primary underline"
              >
                  Forgot your password?
              </Link>
          </div>
        <Input id={`password-${role}`} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Login
      </Button>
    </form>
)

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('admin');
  const { showLoader } = useLoading();

  useEffect(() => {
    const errorType = searchParams.get('error');
    if (errorType === 'blocked') {
        toast({
            title: "Access Denied",
            description: "Your account has been blocked by the administrator.",
            variant: "destructive",
        });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    // If the user is already logged in, redirect them to the dashboard.
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleEmailSignIn = async (e: React.FormEvent, role: 'admin' | 'staff') => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const authenticatedUser = userCredential.user;

      // After successful sign-in, check their role from Firestore
      const userDocRef = doc(db, "users", authenticatedUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.role === role) {
          // Role matches the login panel, proceed and show loader
          showLoader('Dashboard', '/dashboard');
        } else {
          // Role mismatch, sign out and show error toast
          await signOut(auth);
          toast({
            title: 'Access Denied',
            description: `You are a ${userData.role}. Please use the ${userData.role} login panel.`,
            variant: 'destructive',
          });
          setLoading(false);
        }
      } else {
        // User document doesn't exist, something is wrong
        await signOut(auth);
        setAuthError("User data not found. Please contact support.");
        setLoading(false);
      }

    } catch (error) {
      console.error("Error signing in with email and password: ", error);
      let description = "Failed to sign in. Please try again.";
      if ((error as AuthError).code === 'auth/invalid-credential') {
          description = "Invalid credentials. Please check your email and password and try again.";
      }
      setAuthError(description);
      setLoading(false);
    }
  };
  
  if (authLoading || user) {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
            <div>Loading...</div>
        </div>
    );
  }

  const handleTabChange = (value: string) => {
      setActiveTab(value);
      setAuthError(''); // Clear errors when switching tabs
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader className="text-center">
           <div className="flex justify-center mb-2">
              <Package className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Select your role and log in to manage your inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="admin" className="w-full" onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="admin">Admin Login</TabsTrigger>
              <TabsTrigger value="staff">Staff Login</TabsTrigger>
            </TabsList>
            <TabsContent value="admin" className="pt-4">
                <LoginForm 
                    email={email}
                    setEmail={setEmail}
                    password={password}
                    setPassword={setPassword}
                    loading={loading && activeTab === 'admin'}
                    handleEmailSignIn={handleEmailSignIn}
                    authError={authError}
                    role="admin"
                />
            </TabsContent>
            <TabsContent value="staff" className="pt-4">
                <LoginForm 
                    email={email}
                    setEmail={setEmail}
                    password={password}
                    setPassword={setPassword}
                    loading={loading && activeTab === 'staff'}
                    handleEmailSignIn={handleEmailSignIn}
                    authError={authError}
                    role="staff"
                />
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
