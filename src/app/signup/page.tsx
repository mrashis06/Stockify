
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
import { Loader2, Eye, EyeOff, UploadCloud, CheckCircle, AlertCircle, ShieldCheck, RefreshCw, CalendarIcon } from 'lucide-react';
import { extractIdCardData } from '@/ai/flows/extract-id-card-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useDateFormat } from '@/hooks/use-date-format';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

type IdType = 'aadhaar' | 'pan' | 'dl';

const idTypeOptions: { value: IdType, label: string }[] = [
    { value: 'aadhaar', label: 'Aadhaar Card' },
    { value: 'pan', label: 'PAN Card' },
    { value: 'dl', label: 'Driving Licence' },
];

const formSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Phone number must be at least 10 digits').max(15, 'Phone number is too long'),
    dob: z.date({ required_error: "A date of birth is required." }).refine((date) => {
        return differenceInYears(new Date(), date) >= 20;
    }, 'You must be at least 20 years old to sign up.'),
    aadhaar: z.string().min(10, 'ID Number must be at least 10 characters.'),
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
  onRemove,
  selectedIdTypeLabel,
}: {
  onUpload: (file: File) => void;
  isProcessing: boolean;
  fileName: string | null;
  onRemove: () => void;
  selectedIdTypeLabel: string;
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles[0]);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [] },
    multiple: false,
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div className="space-y-2">
      {fileName ? (
         <Alert variant={isProcessing ? "default" : "default"} className={isProcessing ? "bg-blue-50 dark:bg-blue-900/30 border-blue-500/50" : "bg-green-100 dark:bg-green-900/30 border-green-500/50"}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-hidden">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" /> : <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />}
                <span className="text-sm font-medium truncate">{fileName}</span>
            </div>
            <Button type="button" variant="link" size="sm" className="p-0 h-auto font-medium" onClick={onRemove}>
                <RefreshCw className="mr-2 h-4 w-4" /> Change
            </Button>
          </div>
        </Alert>
      ) : (
        <div
          {...getRootProps()}
          onClick={open}
          className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/50 hover:border-primary'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">
            {isDragActive ? `Drop the ${selectedIdTypeLabel} here...` : `Upload ${selectedIdTypeLabel}`}
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
  const { formatDate } = useDateFormat();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selectedIdType, setSelectedIdType] = useState<IdType>('aadhaar');
  const [isProcessingId, setIsProcessingId] = useState(false);
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
      setIdFile(file);
      setIsProcessingId(true);
      setAiError(null);

      const reader = new FileReader();
      reader.onload = async (event) => {
          const dataUri = event.target?.result as string;
          try {
              const result = await extractIdCardData({ idCardDataUri: dataUri, cardType: selectedIdType });

              if (result.cardType !== selectedIdType) {
                  const expectedLabel = idTypeOptions.find(o => o.value === selectedIdType)?.label;
                  const detectedLabel = idTypeOptions.find(o => o.value === result.cardType)?.label || 'an unknown document type';
                  throw new Error(`Validation Failed: You selected ${expectedLabel}, but uploaded ${detectedLabel}. Please upload the correct document.`);
              }
              
              if (result.name) form.setValue('name', result.name, { shouldValidate: true });
              if (result.dob) {
                  const [year, month, day] = result.dob.split('-');
                  if (day && month && year) {
                     form.setValue('dob', parse(result.dob, 'yyyy-MM-dd', new Date()), { shouldValidate: true });
                  }
              }
              if (result.idNumber) form.setValue('aadhaar', result.idNumber.replace(/\s/g, ''), { shouldValidate: true });

          } catch (err) {
              const errorMessage = err instanceof Error ? err.message : "Failed to process the ID card.";
              setAiError(errorMessage);
              // Clear the file so the user has to re-upload
              setIdFile(null);
          } finally {
              setIsProcessingId(false);
          }
      };
      reader.readAsDataURL(file);
  };
  
  const handleRemoveId = () => {
    setIdFile(null);
    setAiError(null);
    form.reset({
        ...form.getValues(),
        name: '',
        dob: undefined,
        aadhaar: '',
    });
  }

  const onSubmit = async (data: SignupFormValues) => {
    setLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      
      const role = ADMIN_UIDS.includes(user.uid) ? 'admin' : 'staff';

      const userDocData: any = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        dob: data.dob.toISOString().split('T')[0], // Store as YYYY-MM-DD
        role: role,
        status: 'active',
        shopId: null,
        createdAt: serverTimestamp(),
      };
      
      // Store the correct ID based on type
      if (selectedIdType === 'aadhaar') {
          userDocData.aadhaar = data.aadhaar;
          userDocData.pan = null;
      } else if (selectedIdType === 'pan') {
          userDocData.pan = data.aadhaar; // The form field is named aadhaar but holds the PAN
          userDocData.aadhaar = null;
      } else { // Driving Licence
           userDocData.dlNumber = data.aadhaar;
           userDocData.aadhaar = null;
           userDocData.pan = null;
      }

      await setDoc(doc(db, "users", user.uid), userDocData);
      
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

  const selectedIdTypeLabel = idTypeOptions.find(opt => opt.value === selectedIdType)?.label || 'ID Card';
  const idNumberLabel = selectedIdType === 'pan' ? 'PAN Number' : selectedIdType === 'dl' ? 'Driving Licence Number' : 'Aadhaar Number';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
          <CardDescription>
            Get started with smart inventory management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              
               <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="aadhaar" // This is a dummy field for the Select, real value is selectedIdType
                      render={({ field }) => (
                         <FormItem>
                             <FormLabel>ID Type</FormLabel>
                             <RadioGroup
                                value={selectedIdType}
                                onValueChange={(value: IdType) => {
                                  setSelectedIdType(value);
                                  handleRemoveId();
                                }}
                                className="flex space-x-4"
                              >
                                {idTypeOptions.map(opt => (
                                  <div key={opt.value} className="flex items-center space-x-2">
                                    <RadioGroupItem value={opt.value} id={opt.value} />
                                    <Label htmlFor={opt.value}>{opt.label}</Label>
                                  </div>
                                ))}
                              </RadioGroup>
                        </FormItem>
                      )}
                    />

                    <IdCardUpload
                        onUpload={handleIdCardUpload}
                        isProcessing={isProcessingId}
                        fileName={idFile?.name || null}
                        onRemove={handleRemoveId}
                        selectedIdTypeLabel={selectedIdTypeLabel}
                    />
               </div>
               
                <Alert className="bg-blue-50 dark:bg-blue-900/30 border-blue-500/50 text-blue-800 dark:text-blue-300 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400">
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Your Data is Secure</AlertTitle>
                  <AlertDescription>
                    Your ID image is used only for one-time data extraction and is never stored. Your personal information is encrypted and protected.
                  </AlertDescription>
                </Alert>


                {aiError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Processing Error</AlertTitle>
                        <AlertDescription>{aiError}</AlertDescription>
                    </Alert>
                )}
              
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Auto-filled from card" {...field} disabled={loading} /></FormControl><FormMessage /></FormItem>
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
                        <FormItem>
                            <FormLabel>{idNumberLabel}</FormLabel>
                            <FormControl><Input placeholder="Auto-filled from card" {...field} disabled={loading} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
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
                                      "w-full pl-3 text-left font-normal",
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
                                  selected={field.value}
                                  onApply={(d) => { field.onChange(d); (document.activeElement as HTMLElement)?.blur() }}
                                  onCancel={() => (document.activeElement as HTMLElement)?.blur()}
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

              <Button type="submit" className="w-full" disabled={loading || isProcessingId}>
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

    
