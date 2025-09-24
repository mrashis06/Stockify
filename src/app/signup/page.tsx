
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, AuthError } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import React, { useState } from 'react';

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
import { ADMIN_UID } from '@/lib/constants';
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!name) {
      toast({
        title: "Name is required",
        description: "Please enter your name.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const role = user.uid === ADMIN_UID ? 'admin' : 'staff';

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        role: role,
        status: 'active', // All new users are active by default
        shopId: null, // Staff will set this in the next step
        createdAt: serverTimestamp(),
      });
      
      if (role === 'staff') {
          router.push('/join-shop');
      } else {
          router.push('/dashboard');
      }

    } catch (error) {
      console.error("Error signing up with email and password: ", error);
      const authError = error as AuthError;
      
      let description = "Failed to sign up. Please try again.";
      if (authError.code === 'auth/email-already-in-use') {
        description = "This email is already registered. Please log in instead.";
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
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
          <CardDescription>
            Get started with smart inventory management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailSignUp} className="grid gap-4">
            <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" type="text" placeholder="John Doe" required value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
            </div>
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
                <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input id="confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign Up
            </Button>
          </form>
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
