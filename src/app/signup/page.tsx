
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, AuthError } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { differenceInYears, parse } from 'date-fns';
import { useDropzone } from 'react-dropzone';

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
import { Loader2, Eye, EyeOff, UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';
import { extractIdCardData } from '@/ai/flows/extract-id-card-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


const formSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits').max(15, 'Phone number is too long'),
    dob: z.date({ required_error: 'Date of birth is required.' })
      .refine(date => differenceInYears(new Date(), date) >= 20, {
        message: 'You must be at least 20 years old to sign up.',
      }),
    aadhaar: z.string().length(12, 'Aadhaar number must be 12 digits'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof formSchema>;

const IdCardUpload = ({
  onUpload,
  isProcessing,
  fileName,
}: {
  onUpload: (file: File) => void;
  isProcessing: boolean;
  fileName: string | null;
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles[0]);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [] },
    multiple: false,
  });

  return (
    <div className="space-y-2">
      <FormLabel>
        Aadhaar Card
      </FormLabel>
      {fileName ? (
        <Alert variant={isProcessing ? "default" : "default"} className={isProcessing ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500/50" : "bg-green-100 dark:bg-green-900/30 border-green-500/50"}>
          <div className="flex items-center gap-2">
             {isProcessing ? <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" /> : <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />}
             <span className="text-sm font-medium truncate">{fileName}</span>
          </div>
        </Alert>
      ) : (
        <div
          {...getRootProps()}
          className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/50 hover:border-primary'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">
            {isDragActive ? `Drop the Aadhaar card here...` : `Upload Aadhaar Card`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Drag & drop or click to select a file</p>
        </div>
      )}
    </div>
  );
};


export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [isProcessingAadhaar, setIsProcessingAadhaar] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  const form = useForm<SignupFormValues>({
      resolver: zodResolver(formSchema),
      defaultValues: {
          name: '',
          email: '',
          phone: '',
          aadhaar: '',
          password: '',
          confirmPassword: '',
      }
  });

  const handleIdCardUpload = async (file: File) => {
      setAadhaarFile(file);
      setIsProcessingAadhaar(true);
      setAiError(null);

      const reader = new FileReader();
      reader.onload = async (event) => {
          const dataUri = event.target?.result as string;
          try {
              const result = await extractIdCardData({ idCardDataUri: dataUri });

              if (result.name) form.setValue('name', result.name, { shouldValidate: true });
              if (result.dob) {
                  const parsedDate = parse(result.dob, 'yyyy-MM-dd', new Date());
                  if (!isNaN(parsedDate.getTime())) {
                      form.setValue('dob', parsedDate, { shouldValidate: true });
                  }
              }
              if (result.aadhaar) form.setValue('aadhaar', result.aadhaar.replace(/\s/g, ''), { shouldValidate: true });

          } catch (err) {
              setAiError(err instanceof Error ? err.message : "Failed to process the ID card.");
          } finally {
              setIsProcessingAadhaar(false);
          }
      };
      reader.readAsDataURL(file);
  };


  const onSubmit = async (data: SignupFormValues) => {
    setLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      
      const role = ADMIN_UIDS.includes(user.uid) ? 'admin' : 'staff';

      await setDoc(doc(db, "users", user.uid), {
        name: data.name,
        email: data.email,
        phone: data.phone,
        dob: data.dob.toISOString().split('T')[0],
        aadhaar: data.aadhaar,
        pan: null, // Set PAN to null
        role: role,
        status: 'active',
        shopId: null,
        createdAt: serverTimestamp(),
      });
      
      router.push('/join-shop');

    } catch (error) {
      console.error("Error signing up with email and password: ", error);
      const authError = error as AuthError;
      
      let description = "Failed to sign up. Please try again.";
      if (authError.code === 'auth/email-already-in-use') {
        description = "This email is already registered. If this is you, please log in.";
      }
      toast({ title: "Signup Error", description, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
          <CardDescription>
            Upload your Aadhaar card to auto-fill your details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              
               <div className="grid grid-cols-1">
                    <IdCardUpload
                        onUpload={(file) => handleIdCardUpload(file)}
                        isProcessing={isProcessingAadhaar}
                        fileName={aadhaarFile?.name || null}
                    />
               </div>

                {aiError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>AI Processing Error</AlertTitle>
                        <AlertDescription>{aiError}</AlertDescription>
                    </Alert>
                )}
              
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Full Name (as on card)" {...field} disabled={loading} /></FormControl><FormMessage /></FormItem>
                )} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email address</FormLabel><FormControl><Input type="email" placeholder="e.g., mail@example.com" {...field} disabled={loading} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="phone" render={({ field }) => (
                        <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="e.g., 9876543210" {...field} disabled={loading} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="aadhaar" render={({ field }) => (
                        <FormItem><FormLabel>Aadhaar Number</FormLabel><FormControl><Input placeholder="XXXX XXXX XXXX" {...field} disabled={loading} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField
                      control={form.control}
                      name="dob"
                      render={({ field }) => (
                          <FormItem>
                              <FormLabel>Date of Birth</FormLabel>
                              <FormControl>
                                <Input placeholder="DD-MM-YYYY" value={field.value ? field.value.toLocaleDateString('en-CA') : ''} readOnly disabled={loading} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )}
                    />
                </div>

                <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Password</FormLabel>
                        <div className="relative">
                             <FormControl>
                                <Input type={showPassword ? 'text' : 'password'} {...field} disabled={loading} className="pr-10" />
                             </FormControl>
                             <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2" onClick={() => setShowPassword(p => !p)}>
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <div className="relative">
                            <FormControl>
                                <Input type={showConfirmPassword ? 'text' : 'password'} {...field} disabled={loading} className="pr-10" />
                            </FormControl>
                            <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2" onClick={() => setShowConfirmPassword(p => !p)}>
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        <FormMessage />
                    </FormItem>
                )} />

              <Button type="submit" className="w-full" disabled={loading || isProcessingAadhaar}>
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
