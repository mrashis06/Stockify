
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useInventory } from '@/hooks/use-inventory';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, UploadCloud, FileCheck2, AlertCircle, Trash2, CheckCircle, Package, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


type ScanBillDialogProps = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
};

export default function ScanBillDialog({ isOpen, onOpenChange }: ScanBillDialogProps) {
    const { processScannedBill } = useInventory();
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ matchedCount: number; unmatchedCount: number; } | null>(null);
    const [isDuplicate, setIsDuplicate] = useState(false);

    const handleClose = useCallback(() => {
        onOpenChange(false);
    }, [onOpenChange]);

    const resetState = useCallback(() => {
        setFile(null);
        setIsLoading(false);
        setError(null);
        setResult(null);
        setIsDuplicate(false);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            const timer = setTimeout(() => {
                resetState();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen, resetState]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
            setError(null);
            setResult(null); 
            setIsDuplicate(false);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'application/pdf': ['.pdf'],
        },
        multiple: false,
    });

    const handleExtraction = async (force = false) => {
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setResult(null);
        setIsDuplicate(false);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUri = event.target?.result as string;
            try {
                const processResult = await processScannedBill(dataUri, file.name, force);
                
                if (processResult.status === 'already_processed') {
                    setIsDuplicate(true);
                } else {
                    setResult(processResult);
                    toast({
                        title: "Scan Complete",
                        description: `Review the results and choose an option.`,
                    });
                }
            } catch (err) {
                console.error("Extraction error:", err);
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
                if (errorMessage.includes("quota")) {
                    setError("Could not process bill. The AI service quota may be exceeded. Please check your API key billing status or try again later.");
                } else {
                    setError(errorMessage);
                }
            } finally {
                setIsLoading(false);
            }
        };
        reader.onerror = () => {
            setError("Failed to read the file.");
            setIsLoading(false);
        }
        reader.readAsDataURL(file);
    };
    
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-48 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground">Analyzing your bill, please wait...</p>
                    <p className="text-xs text-muted-foreground">(This may take up to a minute)</p>
                </div>
            );
        }

        if (isDuplicate) {
            return (
                <div className="space-y-4">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Duplicate Bill</AlertTitle>
                        <AlertDescription>
                            This bill appears to have been processed already. Re-processing may create duplicate stock entries. Do you want to continue?
                        </AlertDescription>
                    </Alert>
                    <div className="grid grid-cols-2 gap-4">
                        <Button onClick={resetState} variant="outline">
                            <Trash2 className="mr-2 h-4 w-4" /> Cancel & Discard
                        </Button>
                        <Button onClick={() => handleExtraction(true)}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Process Anyway
                        </Button>
                    </div>
                </div>
            );
        }
        
        if (error) {
            return (
                 <div className="space-y-4">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Extraction Failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <Button onClick={resetState} className="w-full">Try Again</Button>
                </div>
            );
        }

        if (result) {
            return (
                 <div className="space-y-4 text-center">
                    <Alert variant="default" className="bg-green-100 dark:bg-green-900/30 border-green-500/50">
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <AlertTitle className="text-green-800 dark:text-green-300">Scan Successful</AlertTitle>
                        <AlertDescription className="text-green-700 dark:text-green-400 text-left">
                            <p><strong>{result.matchedCount}</strong> items were automatically matched and added to Godown.</p>
                            <p><strong>{result.unmatchedCount}</strong> items need manual review in the "Unprocessed Deliveries" section.</p>
                        </AlertDescription>
                    </Alert>
                    <div className="grid grid-cols-2 gap-4">
                        <Button onClick={resetState} variant="outline">Scan Again</Button>
                        <Button onClick={handleClose}>Done</Button>
                    </div>
                </div>
            );
        }

        if (file) {
            return (
                <div className="space-y-4">
                    <div className="p-4 border rounded-lg flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 overflow-hidden">
                           <FileCheck2 className="h-6 w-6 text-green-500 shrink-0" />
                           <p className="truncate text-sm font-medium">{file.name}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                    <Button onClick={() => handleExtraction(false)} className="w-full" disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
                        Process Bill
                    </Button>
                </div>
            );
        }

        return (
            <div
                {...getRootProps()}
                className={`p-12 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/50 hover:border-primary'
                }`}
            >
                <input {...getInputProps()} />
                <UploadCloud className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="mt-4 font-semibold">
                    {isDragActive ? 'Drop the bill here...' : 'Drag & drop a file or click to select'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Supports PNG, JPG, or PDF files.</p>
            </div>
        );
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Scan New Bill</DialogTitle>
                    <DialogDescription>
                        Upload a bill to automatically stock your Godown. New items will be sent to a holding area for review.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="py-4">
                    {renderContent()}
                </div>

                <DialogFooter>
                     {!result && !isDuplicate && (
                        <Button variant="secondary" onClick={handleClose}>
                            Cancel
                        </Button>
                     )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
