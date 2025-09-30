
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
import { Loader2, UploadCloud, FileCheck2, AlertCircle, Trash2, CheckCircle, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


type ScanBillDialogProps = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
};

export default function ScanBillDialog({ isOpen, onOpenChange }: ScanBillDialogProps) {
    const { processScannedBill, forceRefetch } = useInventory();
    const { toast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<{ matchedCount: number; unmatchedCount: number; } | null>(null);

    const handleClose = useCallback(() => {
        onOpenChange(false);
    }, [onOpenChange]);

    const resetState = useCallback(() => {
        setFile(null);
        setIsLoading(false);
        setError(null);
        setResult(null);
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

    const handleExtraction = async () => {
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setResult(null);

        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUri = event.target?.result as string;
            try {
                const processResult = await processScannedBill(dataUri);
                setResult(processResult);
                toast({
                    title: "Bill Processed Successfully",
                    description: `${processResult.matchedCount} items auto-stocked, ${processResult.unmatchedCount} items need review.`,
                });
                forceRefetch();
                handleClose(); // Automatically close dialog on success
            } catch (err) {
                console.error("Extraction error:", err);
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
                if (errorMessage.includes("quota")) {
                    setError("Could not process bill. The AI service quota may be exceeded. Please check your API key billing status or try again later.");
                } else {
                    setError("An error occurred while processing the bill. The AI might be unavailable, or the file could be corrupted.");
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
        
        if (error) {
            return (
                 <div className="space-y-4">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Extraction Failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <Button onClick={() => { setError(null); setFile(null); }} className="w-full">Try Again</Button>
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
                    <Button onClick={handleExtraction} className="w-full" disabled={isLoading}>
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
                    <Button variant="secondary" onClick={handleClose}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
