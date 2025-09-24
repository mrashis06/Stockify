
"use client";

import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
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
import { Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSubmitted(true);
    } catch (error) {
      console.error("Error sending password reset email: ", error);
      toast({
        title: "Error",
        description: "Could not send password reset email. Please check the address and try again.",
        variant: "destructive",
      });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
          <CardDescription>
            {submitted 
              ? "Check your inbox for a password reset link." 
              : "Enter your email to receive a password reset link."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!submitted ? (
            <form onSubmit={handlePasswordReset} className="grid gap-4">
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Link
              </Button>
            </form>
          ) : (
             <div className="text-center">
                <p className="text-muted-foreground">
                    If an account exists for {email}, you will receive an email with instructions on how to reset your password.
                </p>
             </div>
          )}
           <div className="mt-4 text-center text-sm">
            Remembered your password?{' '}
            <Link href="/login" className="text-primary underline">
              Log In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
